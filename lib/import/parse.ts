/**
 * Excel import parser. Reads the Kyron event workbook with ExcelJS and turns
 * the CHECKLIST / BUDGET / MASTER SCHEDULE / CONTACTS / SITE MAP sheets into
 * structured, typed rows.
 *
 * Key behaviours (from the brief):
 *  - Section / category header rows (a lone heading in column A) are carried
 *    down onto the item rows beneath them.
 *  - The Master Schedule's date-block header rows (a Date in column A) set the
 *    current event date for the entries that follow.
 *  - Spreadsheet error cells (#REF!, #VALUE!, #N/A, #DIV/0!) are collected as
 *    warnings and never parsed as values.
 *  - Times and Excel serial dates are normalised via lib/calc/time.
 */
import ExcelJS from "exceljs";
import { dollarsToCents } from "@/lib/calc/money";
import { parseWorkbookTime, parseExcelDate, toISODate } from "@/lib/calc/time";
import {
  SCHEDULE_TYPES,
  type ParsedWorkbook,
  type ParsedChecklistItem,
  type ParsedBudgetItem,
  type ParsedScheduleEntry,
  type ParsedContact,
  type ParsedSiteMap,
  type ParsedCrewShift,
  type ParsedPower,
  type ParsedStructure,
  type ParsedFencing,
  type ParsedFurniture,
  type ParsedToilet,
  type ParsedTransport,
  type ParsedProduction,
  type ParsedManagementTask,
  type ParsedInfrastructure,
  type ParseWarning,
  type ScheduleTypeEnum,
} from "./types";

type Primitive = string | number | boolean | Date | null;

const ERROR_VALUES = new Set(["#REF!", "#VALUE!", "#N/A", "#DIV/0!", "#NAME?", "#NULL!", "#NUM!"]);

function detectError(v: unknown): string | null {
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (obj.result && typeof obj.result === "object") {
      const r = obj.result as Record<string, unknown>;
      if (typeof r.error === "string") return r.error;
    }
  }
  if (typeof v === "string" && ERROR_VALUES.has(v.trim())) return v.trim();
  return null;
}

/** Normalise an ExcelJS cell value into a primitive + any error code. */
function readCell(cell: ExcelJS.Cell): { value: Primitive; error: string | null } {
  const v = cell.value as unknown;
  const error = detectError(v);
  if (error) return { value: null, error };
  if (v === null || v === undefined) return { value: null, error: null };
  if (v instanceof Date) return { value: v, error: null };
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return {
        value: (obj.richText as { text?: string }[]).map((t) => t.text ?? "").join(""),
        error: null,
      };
    }
    if ("formula" in obj || "sharedFormula" in obj) {
      const r = obj.result as unknown;
      const rErr = detectError(r);
      if (rErr) return { value: null, error: rErr };
      if (r === null || r === undefined) return { value: null, error: null };
      if (r instanceof Date) return { value: r, error: null };
      if (typeof r === "object" && "text" in (r as object)) {
        return { value: String((r as { text: unknown }).text), error: null };
      }
      return { value: r as Primitive, error: null };
    }
    if ("text" in obj) return { value: (obj.text as string) ?? null, error: null }; // hyperlink
    return { value: null, error: null };
  }
  return { value: v as Primitive, error: null };
}

function asStr(v: Primitive): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (v instanceof Date) return toISODate(v) ?? undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function asBool(v: Primitive): boolean {
  if (v === true) return true;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return /^(true|yes|y|x|✓|done|paid|booked|sent)$/i.test(v.trim());
  return false;
}

function isAllCaps(s: string): boolean {
  return /[A-Z]/.test(s) && s === s.toUpperCase();
}

/**
 * Guard the BUDGET RFQ# column: only accept a value that contains a digit
 * (e.g. "RFQ-001"). The source workbook sometimes has a supplier name typed
 * into that column — those must not become RFQ references.
 */
function asRfqRef(v: string | undefined): string | undefined {
  return v && /\d/.test(v) ? v : undefined;
}

/**
 * A section/category header row has a heading in column A and nothing else of
 * substance. Merged header cells make ExcelJS mirror the heading text into the
 * other columns, so a column counts as "empty" if it's blank OR equals the
 * heading text. Confirmed by all-caps text or a bold column-A cell.
 */
function isHeadingRow(others: Primitive[], heading: string, bold: boolean): boolean {
  const clear = others.every((x) => {
    const s = asStr(x);
    return s === undefined || s === heading;
  });
  return clear && (isAllCaps(heading) || bold);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bs\b/g, "s");
}

function getSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  const target = name.toUpperCase();
  return wb.worksheets.find((ws) => ws.name.trim().toUpperCase() === target);
}

/** Scan every sheet for spreadsheet error cells -> warnings. */
function scanErrors(wb: ExcelJS.Workbook): ParseWarning[] {
  const warnings: ParseWarning[] = [];
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const error = detectError(cell.value);
        if (error) {
          warnings.push({
            sheet: ws.name,
            cell: cell.address,
            kind: "formula_error",
            message: `${ws.name}!${cell.address} = ${error}`,
          });
        }
      });
    });
  }
  return warnings;
}

function mapScheduleType(raw: string | undefined): {
  type: ScheduleTypeEnum | null;
  raw?: string;
} {
  if (!raw) return { type: null };
  const norm = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if ((SCHEDULE_TYPES as string[]).includes(norm)) {
    return { type: norm as ScheduleTypeEnum };
  }
  return { type: null, raw };
}

function parseChecklist(ws: ExcelJS.Worksheet): ParsedChecklistItem[] {
  const items: ParsedChecklistItem[] = [];
  let section = "General";
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 2) return; // title + header
    const a = readCell(row.getCell(1)).value;
    const b = readCell(row.getCell(2)).value;
    const c = readCell(row.getCell(3)).value;
    const d = readCell(row.getCell(4)).value;
    const e = readCell(row.getCell(5));
    const f = readCell(row.getCell(6));
    const g = readCell(row.getCell(7));
    const item = asStr(a);
    if (!item) return;
    const bold = row.getCell(1).font?.bold ?? false;
    if (isHeadingRow([b, c, d, e.value, f.value, g.value], item, bold)) {
      section = item;
      return;
    }
    items.push({
      section,
      item,
      details: asStr(b),
      supplier: asStr(c),
      responsible: asStr(d),
      rfqSent: asBool(e.value),
      booked: asBool(f.value),
      paid: asBool(g.value),
      rowRef: `${ws.name}!${rowNumber}`,
    });
  });
  return items;
}

function parseBudget(ws: ExcelJS.Worksheet): ParsedBudgetItem[] {
  const items: ParsedBudgetItem[] = [];
  let category = "General";
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 4) return; // title + header
    const a = readCell(row.getCell(1)).value; // ITEM
    const b = readCell(row.getCell(2)).value; // SUPPLIER
    const c = readCell(row.getCell(3)).value; // INSURANCE
    const d = readCell(row.getCell(4)).value; // QUOTED ex gst
    const e = readCell(row.getCell(5)).value; // ACTUAL inc GST
    const fCell = row.getCell(6); // QUOTE link
    const g = readCell(row.getCell(7)).value; // APPROVED
    const h = readCell(row.getCell(8)).value; // PAID
    const i = readCell(row.getCell(9)).value; // NOTES
    const y = readCell(row.getCell(25)).value; // RFQ #
    const item = asStr(a);
    if (!item) return;
    if (/^(site total|grand total|total|subtotal)/i.test(item)) return;
    const link = readCell(fCell).value;
    const bold = row.getCell(1).font?.bold ?? false;
    if (isHeadingRow([b, c, d, e, link, g, h, i], item, bold)) {
      category = item;
      return;
    }
    items.push({
      category,
      item,
      supplier: asStr(b),
      insurance: asStr(c),
      quotedExGstCents: dollarsToCents(d as string | number | null),
      actualIncGstCents: dollarsToCents(e as string | number | null),
      quoteLink: asStr(link),
      approved: asBool(g),
      paid: asBool(h),
      rfqNo: asRfqRef(asStr(y)),
      notes: asStr(i),
      rowRef: `${ws.name}!${rowNumber}`,
    });
  });
  return items;
}

function parseSchedule(ws: ExcelJS.Worksheet, warnings: ParseWarning[]): ParsedScheduleEntry[] {
  const entries: ParsedScheduleEntry[] = [];
  let currentDate: string | null = null;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const aCell = readCell(row.getCell(1));
    // Date-block header: a Date in column A sets the current event date.
    if (aCell.value instanceof Date) {
      currentDate = toISODate(aCell.value);
      return;
    }
    const a = asStr(aCell.value);
    if (a && /^start$/i.test(a)) return; // repeated column header
    const c = asStr(readCell(row.getCell(3)).value); // TYPE
    const dSup = asStr(readCell(row.getCell(4)).value); // SUPPLIER
    const e = asStr(readCell(row.getCell(5)).value); // ACTION
    const f = asStr(readCell(row.getCell(6)).value); // LOCATION
    const g = asStr(readCell(row.getCell(7)).value); // SITE POC
    const h = asStr(readCell(row.getCell(8)).value); // NOTES
    const startTime = parseWorkbookTime(aCell.value);
    const finishTime = parseWorkbookTime(readCell(row.getCell(2)).value);
    const completed = asBool(readCell(row.getCell(9)).value);
    // An entry needs at least an action, a type, or a time.
    if (!e && !c && !startTime && !dSup) return;
    const mapped = mapScheduleType(c);
    if (c && !mapped.type) {
      warnings.push({
        sheet: ws.name,
        cell: `C${rowNumber}`,
        kind: "unmapped_type",
        message: `Unrecognised schedule type "${c}" at ${ws.name}!C${rowNumber}`,
      });
    }
    entries.push({
      eventDate: currentDate,
      startTime,
      finishTime,
      type: mapped.type,
      typeRaw: mapped.raw,
      supplier: dSup,
      action: e,
      location: f,
      sitePoc: g,
      notes: h,
      completed,
      rowRef: `${ws.name}!${rowNumber}`,
    });
  });
  return entries;
}

function parseContacts(ws: ExcelJS.Worksheet): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 2) return;
    const position = asStr(readCell(row.getCell(1)).value);
    const name = asStr(readCell(row.getCell(2)).value);
    const company = asStr(readCell(row.getCell(3)).value);
    const mobile = asStr(readCell(row.getCell(4)).value);
    const email = asStr(readCell(row.getCell(5)).value);
    if (!position && !name && !company) return;
    if (position && isAllCaps(position) && !name && !company) return; // section heading
    contacts.push({ position, name, company, mobile, email, rowRef: `${ws.name}!${rowNumber}` });
  });
  return contacts;
}

function parseSiteMaps(ws: ExcelJS.Worksheet): ParsedSiteMap[] {
  const maps: ParsedSiteMap[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const aCell = row.getCell(1);
    const bCell = row.getCell(2);
    const label = asStr(readCell(aCell).value);
    const bVal = readCell(bCell).value;
    const url = asStr(bVal) ?? asStr((bCell.value as { hyperlink?: string })?.hyperlink ?? null);
    if (!label && !url) return;
    if (label && /^site map$/i.test(label) && !url) return; // title
    maps.push({ label, url, rowRef: `${ws.name}!${rowNumber}` });
  });
  return maps;
}

function asNum(v: Primitive): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) && v.trim() !== "" ? n : null;
  }
  return null;
}

/** Parse an Australian "Saturday 01/08/26" style date to ISO YYYY-MM-DD. */
function parseAuDate(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCrew(ws: ExcelJS.Worksheet): ParsedCrewShift[] {
  const shifts: ParsedCrewShift[] = [];
  let currentDate: string | null = null;
  let currentLabel: string | undefined;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const a = readCell(row.getCell(1)).value; // START / date
    const aStr = asStr(a);

    // Day-block header: a date in column A.
    const maybeDate = parseAuDate(aStr);
    if (maybeDate) {
      currentDate = maybeDate;
      const labelC = asStr(readCell(row.getCell(3)).value);
      currentLabel = labelC && !/hrs/i.test(labelC) ? labelC : undefined;
      return;
    }
    if (aStr && /^start$/i.test(aStr)) return; // column header

    const c = asStr(readCell(row.getCell(3)).value);
    const f = readCell(row.getCell(6)).value; // rate $/hr
    if ((c && /daily total/i.test(c)) || (asStr(f) && /daily total/i.test(asStr(f)!))) return;

    const role = asStr(readCell(row.getCell(5)).value);
    const startTime = parseWorkbookTime(a);
    const finishTime = parseWorkbookTime(readCell(row.getCell(2)).value);
    const scheduledHours = asNum(readCell(row.getCell(3)).value);
    const actualHours = asNum(readCell(row.getCell(4)).value);
    const rateCents = dollarsToCents(f as string | number | null);

    // A shift row needs a role, a time, or hours.
    if (!role && !startTime && scheduledHours == null && actualHours == null) return;

    shifts.push({
      shiftDate: currentDate,
      dayLabel: currentLabel,
      role,
      startTime,
      finishTime,
      scheduledHours,
      actualHours,
      rateCents,
      rowRef: `${ws.name}!${rowNumber}`,
    });
  });
  return shifts;
}

function parsePower(ws: ExcelJS.Worksheet): ParsedPower[] {
  const out: ParsedPower[] = [];
  let category = "General";
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (rn === 1) return;
    const a = asStr(readCell(row.getCell(1)).value);
    const b = readCell(row.getCell(2)).value;
    const c = readCell(row.getCell(3)).value;
    const d = readCell(row.getCell(4)).value;
    const e = readCell(row.getCell(5)).value;
    if (!a) return;
    const bStr = asStr(b);
    if (bStr && /qty/i.test(bStr)) return; // header row
    if (/^(kva|outlets|item)$/i.test(a)) return;
    const otherEmpty = !bStr && !asStr(c) && !asStr(d) && !asStr(e);
    if (otherEmpty && (isAllCaps(a) || (row.getCell(1).font?.bold ?? false))) {
      category = a;
      return;
    }
    out.push({
      category,
      item: a,
      quantity: asNum(b),
      location: asStr(c),
      deliveryDate: toISODate(parseExcelDate(d)),
      collectionDate: toISODate(parseExcelDate(e)),
      rowRef: `${ws.name}!${rn}`,
    });
  });
  return out;
}

function parseStructures(ws: ExcelJS.Worksheet): ParsedStructure[] {
  const out: ParsedStructure[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    const a = asStr(readCell(row.getCell(1)).value);
    const b = asStr(readCell(row.getCell(2)).value);
    const c = asStr(readCell(row.getCell(3)).value);
    if (!c) return;
    if (/name$/i.test(c)) return; // "MARQUEE NAME" / "STRUCTURE NAME" header
    if (a && /^(responsible|marquees|other|major structures)/i.test(a)) return;
    out.push({
      name: c,
      type: b,
      responsible: a,
      lengthM: asNum(readCell(row.getCell(4)).value),
      widthM: asNum(readCell(row.getCell(5)).value),
      pegged: asBool(readCell(row.getCell(6)).value),
      weighted: asBool(readCell(row.getCell(7)).value),
      lighting: asBool(readCell(row.getCell(8)).value),
      walls: asStr(readCell(row.getCell(9)).value),
      notes: asStr(readCell(row.getCell(10)).value),
      docsReceived: asBool(readCell(row.getCell(11)).value),
      link: asStr(readCell(row.getCell(12)).value),
      engineerSignoff: asBool(readCell(row.getCell(13)).value),
      rowRef: `${ws.name}!${rn}`,
    });
  });
  return out;
}

function parseFencing(ws: ExcelJS.Worksheet): ParsedFencing[] {
  const out: ParsedFencing[] = [];
  let fenceType = "General";
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (rn === 1) return;
    const a = asStr(readCell(row.getCell(1)).value);
    const b = asStr(readCell(row.getCell(2)).value);
    const c = readCell(row.getCell(3)).value;
    const d = readCell(row.getCell(4)).value;
    if (!a) return;
    if (/^location$/i.test(a)) return; // header
    const otherEmpty = !b && !asStr(c) && !asStr(d);
    if (otherEmpty && (isAllCaps(a) || (row.getCell(1).font?.bold ?? false))) {
      fenceType = a;
      return;
    }
    out.push({
      fenceType,
      location: a,
      type: b,
      lengthM: asNum(c),
      mitigationM: asNum(d),
      notes: asStr(readCell(row.getCell(6)).value),
      rowRef: `${ws.name}!${rn}`,
    });
  });
  return out;
}

function parseFurniture(ws: ExcelJS.Worksheet): ParsedFurniture[] {
  const out: ParsedFurniture[] = [];
  const assetByCol = new Map<number, string>();
  const hr = ws.getRow(2);
  for (let c = 2; c <= 14; c++) {
    const v = asStr(readCell(hr.getCell(c)).value);
    if (v && !/^location$/i.test(v)) assetByCol.set(c, v);
  }
  const sub1 = asStr(readCell(ws.getRow(3).getCell(3)).value);
  const sub2 = asStr(readCell(ws.getRow(3).getCell(4)).value);
  if (sub1) assetByCol.set(3, `Tables ${sub1}`);
  if (sub2) assetByCol.set(4, `Tables ${sub2}`);

  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (rn <= 3) return;
    const loc = asStr(readCell(row.getCell(1)).value);
    if (!loc || /^(total|supplier)$/i.test(loc)) return;
    for (const [col, asset] of assetByCol) {
      const q = asNum(readCell(row.getCell(col)).value);
      if (q && q > 0) out.push({ location: loc, asset, quantity: q, rowRef: `${ws.name}!${rn}` });
    }
  });
  return out;
}

function parseToilets(ws: ExcelJS.Worksheet): ParsedToilet[] {
  const general: ParsedToilet[] = [];
  const vip: ParsedToilet[] = [];
  let capG: number | null = null;
  let capV: number | null = null;
  let tgtG: number | null = null;
  let tgtV: number | null = null;
  const typeRe = /pan|urinal|chem|acrod|toilet/i;

  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    const aCell = readCell(row.getCell(1));
    const a = asStr(aCell.value);
    const b = readCell(row.getCell(2)).value;
    const c = readCell(row.getCell(3)).value;
    const dStr = asStr(readCell(row.getCell(4)).value);
    const e = readCell(row.getCell(5)).value;
    const f = readCell(row.getCell(6)).value;

    if (a && /^capacity$/i.test(a)) {
      capG = asNum(c);
      capV = asNum(f);
      return;
    }
    if (asStr(b) && /toilet ratio/i.test(asStr(b)!)) {
      tgtG = asNum(aCell.value);
      tgtV = asNum(readCell(row.getCell(4)).value);
      return;
    }
    if (a && typeRe.test(a) && !/total/i.test(a)) {
      const q = asNum(b);
      const p = asNum(c);
      if ((q && q > 0) || (p && p > 0)) {
        general.push({ area: "General", toiletType: a, quantity: q, pans: p, capacity: null, ratioTarget: null, rowRef: `${ws.name}!${rn}` });
      }
    }
    if (dStr && typeRe.test(dStr) && !/total/i.test(dStr)) {
      const q = asNum(e);
      const p = asNum(f);
      if ((q && q > 0) || (p && p > 0)) {
        vip.push({ area: "VIP", toiletType: dStr, quantity: q, pans: p, capacity: null, ratioTarget: null, rowRef: `${ws.name}!${rn}` });
      }
    }
  });

  for (const r of general) {
    r.capacity = capG;
    r.ratioTarget = tgtG;
  }
  for (const r of vip) {
    r.capacity = capV;
    r.ratioTarget = tgtV;
  }
  return [...general, ...vip];
}

function parseTransport(ws: ExcelJS.Worksheet): ParsedTransport[] {
  const out: ParsedTransport[] = [];
  let direction = "incoming";
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    const aCell = readCell(row.getCell(1));
    const a = asStr(aCell.value);
    if (a && /in-?coming/i.test(a)) {
      direction = "incoming";
      return;
    }
    if (a && /out-?going/i.test(a)) {
      direction = "outgoing";
      return;
    }
    if (a && /^date$/i.test(a)) return;
    const moveDate = toISODate(parseExcelDate(aCell.value));
    const item = asStr(readCell(row.getCell(3)).value);
    if (!moveDate && !item) return;
    out.push({
      direction,
      moveDate,
      moveTime: parseWorkbookTime(readCell(row.getCell(2)).value),
      item,
      fromTo: asStr(readCell(row.getCell(4)).value),
      truckType: asStr(readCell(row.getCell(5)).value),
      doorsFacing: asStr(readCell(row.getCell(6)).value),
      gateEntry: asStr(readCell(row.getCell(7)).value),
      contactPerson: asStr(readCell(row.getCell(8)).value),
      rowRef: `${ws.name}!${rn}`,
    });
  });
  return out;
}

function parseProduction(ws: ExcelJS.Worksheet): ParsedProduction[] {
  const out: ParsedProduction[] = [];
  let currentDate: string | null = null;
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    const aCell = readCell(row.getCell(1));
    if (aCell.value instanceof Date) {
      currentDate = toISODate(aCell.value);
      return;
    }
    const a = asStr(aCell.value);
    if (a && /^start$/i.test(a)) return;
    const activity = asStr(readCell(row.getCell(3)).value);
    if (activity && /^activity$/i.test(activity)) return;
    const start = parseWorkbookTime(aCell.value);
    if (!activity && !start) return;
    out.push({
      itemDate: currentDate,
      startTime: start,
      finishTime: parseWorkbookTime(readCell(row.getCell(2)).value),
      activity,
      notes: asStr(readCell(row.getCell(4)).value),
      rowRef: `${ws.name}!${rn}`,
    });
  });
  return out;
}

function parseManagement(ws: ExcelJS.Worksheet): ParsedManagementTask[] {
  const out: ParsedManagementTask[] = [];
  let weekDate: string | null = null;
  let weekLabel: string | undefined;
  let weekRate: number | null = null;
  let buffer: ParsedManagementTask[] = [];

  // The week's rate often sits on the first numbered task, below the
  // "Weekly Team Meetings" row — so apply it to the whole week on flush.
  const flush = () => {
    for (const t of buffer) t.rateCents = weekRate;
    out.push(...buffer);
    buffer = [];
  };

  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (rn === 1) return;
    const a = asStr(readCell(row.getCell(1)).value);
    if (a && /week/i.test(a) && /\d+\/\d+\/\d+/.test(a)) {
      flush();
      const [datePart, labelPart] = a.split("|");
      weekDate = parseAuDate(datePart);
      weekLabel = labelPart ? labelPart.trim() : a.trim();
      weekRate = null;
      return;
    }
    const c = asStr(readCell(row.getCell(3)).value);
    if (!c || /^tasks$/i.test(c) || /total hrs/i.test(c)) return;
    const g = dollarsToCents(readCell(row.getCell(7)).value as string | number | null);
    if (g != null) weekRate = g;
    buffer.push({
      weekDate,
      weekLabel,
      taskNo: asNum(readCell(row.getCell(2)).value),
      task: c,
      hours: asNum(readCell(row.getCell(4)).value),
      completed: asBool(readCell(row.getCell(5)).value),
      role: asStr(readCell(row.getCell(6)).value),
      rateCents: null,
      rowRef: `${ws.name}!${rn}`,
    });
  });
  flush();
  return out;
}

function deriveEventName(wb: ExcelJS.Workbook): string {
  const ws = getSheet(wb, "MASTER SCHEDULE");
  if (ws) {
    const raw = asStr(readCell(ws.getCell("B1")).value);
    if (raw) return titleCase(raw.split(/\r?\n/)[0].trim());
  }
  return "Imported Event";
}

export async function parseWorkbook(
  data: ExcelJS.Buffer | ArrayBuffer | Buffer,
): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ExcelJS.Buffer);

  const warnings = scanErrors(wb);

  const checklistWs = getSheet(wb, "CHECKLIST");
  const budgetWs = getSheet(wb, "BUDGET");
  const scheduleWs = getSheet(wb, "MASTER SCHEDULE");
  const contactsWs = getSheet(wb, "CONTACTS BILLING");
  const siteMapWs = getSheet(wb, "SITE MAP");
  const crewWs = getSheet(wb, "CREW SCHEDULE");

  const checklist = checklistWs ? parseChecklist(checklistWs) : [];
  const budget = budgetWs ? parseBudget(budgetWs) : [];
  const schedule = scheduleWs ? parseSchedule(scheduleWs, warnings) : [];
  const contacts = contactsWs ? parseContacts(contactsWs) : [];
  const siteMaps = siteMapWs ? parseSiteMaps(siteMapWs) : [];
  const crew = crewWs ? parseCrew(crewWs) : [];

  const powerWs = getSheet(wb, "POWER");
  const structuresWs = getSheet(wb, "MAJOR STRUCTURES");
  const fencingWs = getSheet(wb, "FENCING");
  const furnitureWs = getSheet(wb, "FURNITURE DISTRO");
  const toiletWs = getSheet(wb, "TOILET RATIO CALC");
  const transportWs = getSheet(wb, "TRANSPORT SCHEDULE");
  const productionWs = getSheet(wb, "PRODUCTION SCHEDULE");
  const mgmtWs = getSheet(wb, "MGMT SCHEDULE");

  const infrastructure: ParsedInfrastructure = {
    power: powerWs ? parsePower(powerWs) : [],
    structures: structuresWs ? parseStructures(structuresWs) : [],
    fencing: fencingWs ? parseFencing(fencingWs) : [],
    furniture: furnitureWs ? parseFurniture(furnitureWs) : [],
    toilets: toiletWs ? parseToilets(toiletWs) : [],
    transport: transportWs ? parseTransport(transportWs) : [],
    production: productionWs ? parseProduction(productionWs) : [],
  };
  const management = mgmtWs ? parseManagement(mgmtWs) : [];

  return {
    eventName: deriveEventName(wb),
    checklist,
    budget,
    schedule,
    contacts,
    siteMaps,
    crew,
    infrastructure,
    management,
    warnings,
    counts: {
      checklist: checklist.length,
      budget: budget.length,
      schedule: schedule.length,
      contacts: contacts.length,
      siteMaps: siteMaps.length,
      crew: crew.length,
      power: infrastructure.power.length,
      structures: infrastructure.structures.length,
      fencing: infrastructure.fencing.length,
      furniture: infrastructure.furniture.length,
      toilets: infrastructure.toilets.length,
      transport: infrastructure.transport.length,
      production: infrastructure.production.length,
      management: management.length,
      warnings: warnings.length,
    },
  };
}
