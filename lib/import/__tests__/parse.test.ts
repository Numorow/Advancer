import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWorkbook } from "../parse";
import type { ParsedWorkbook } from "../types";

const WORKBOOK = resolve(process.cwd(), "MASTER_WIP_TEMPLATE.xlsx");

describe("parseWorkbook (real Calcio Italiano 2026 workbook)", () => {
  let parsed: ParsedWorkbook;

  beforeAll(async () => {
    const buf = readFileSync(WORKBOOK);
    parsed = await parseWorkbook(buf);
  });

  it("derives the event name from MASTER SCHEDULE", () => {
    expect(parsed.eventName).toBe("Calcio Italiano 2026");
  });

  it("extracts checklist items with sections", () => {
    expect(parsed.checklist.length).toBeGreaterThan(50);
    const sections = new Set(parsed.checklist.map((i) => i.section));
    expect([...sections].some((s) => /PORTABLES/i.test(s))).toBe(true);
  });

  it("extracts budget items grouped by category", () => {
    expect(parsed.budget.length).toBeGreaterThan(20);
    const cats = new Set(parsed.budget.map((i) => i.category));
    expect([...cats].some((c) => /POWER|ELECTRICIAN/i.test(c))).toBe(true);
    // money parsed to integer cents, never NaN
    for (const b of parsed.budget) {
      expect(b.quotedExGstCents === null || Number.isInteger(b.quotedExGstCents)).toBe(true);
      expect(b.actualIncGstCents === null || Number.isInteger(b.actualIncGstCents)).toBe(true);
      // RFQ# guard: a captured rfqNo must look like a reference (contain a digit)
      if (b.rfqNo) expect(b.rfqNo).toMatch(/\d/);
    }
  });

  it("extracts schedule entries with date blocks and typed times", () => {
    expect(parsed.schedule.length).toBeGreaterThan(50);
    const withDate = parsed.schedule.filter((e) => e.eventDate);
    expect(withDate.length).toBeGreaterThan(0);
    expect(withDate.some((e) => e.eventDate === "2026-08-01")).toBe(true);
    // any populated time must be normalised HH:MM
    for (const e of parsed.schedule) {
      if (e.startTime) expect(e.startTime).toMatch(/^\d{2}:\d{2}$/);
      if (e.finishTime) expect(e.finishTime).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("flags the known spreadsheet formula errors as warnings (not values)", () => {
    const keys = new Set(parsed.warnings.map((w) => `${w.sheet}!${w.cell}`));
    expect(keys.has("CONTACTS BILLING!C12")).toBe(true);
    expect(keys.has("ESTIMATE!D12")).toBe(true);
    expect(keys.has("ESTIMATE!D22")).toBe(true);
    expect(keys.has("ESTIMATE!D31")).toBe(true);
    expect(keys.has("CREW SCHEDULE!K5")).toBe(true);
    expect(keys.has("TOILET RATIO CALC!F10")).toBe(true);
  });

  it("extracts crew shifts with dates, roles and rates", () => {
    expect(parsed.crew.length).toBeGreaterThan(10);
    const withDate = parsed.crew.filter((s) => s.shiftDate);
    expect(withDate.some((s) => s.shiftDate === "2026-08-01")).toBe(true);
    expect(parsed.crew.some((s) => /manager/i.test(s.role ?? ""))).toBe(true);
    for (const s of parsed.crew) {
      expect(s.rateCents === null || Number.isInteger(s.rateCents)).toBe(true);
      expect(s.actualHours === null || Number.isFinite(s.actualHours)).toBe(true);
    }
  });

  it("extracts infrastructure registers from the workbook", () => {
    const i = parsed.infrastructure;
    expect(i.power.length).toBeGreaterThan(3);
    expect(i.fencing.length).toBeGreaterThan(3);
    expect(i.fencing.some((f) => f.lengthM === 55 && f.mitigationM === 5.5)).toBe(true);
    // toilets: General area totals 42 pans (SINGLE CHEM 40 + ACROD 2)
    const generalPans = i.toilets
      .filter((t) => t.area === "General")
      .reduce((a, t) => a + (t.pans ?? 0), 0);
    expect(generalPans).toBe(42);
    expect(i.toilets.some((t) => t.area === "General" && t.capacity === 3000 && t.ratioTarget === 75)).toBe(true);
    // structures captured with engineer sign-off booleans
    expect(i.structures.length).toBeGreaterThan(0);
    for (const s of i.structures) expect(typeof s.engineerSignoff).toBe("boolean");
  });

  it("extracts management tasks grouped by week", () => {
    expect(parsed.management.length).toBeGreaterThan(10);
    expect(parsed.management.some((m) => m.weekDate === "2026-06-01")).toBe(true);
    // labels (WEEK 1..5) repeat per month, so group by the week's date.
    const week1 = parsed.management.filter((m) => m.weekDate === "2026-06-01");
    expect(week1.reduce((a, m) => a + (m.hours ?? 0), 0)).toBe(29);
    // week rate applied to every task in the week (incl. the meetings row)
    expect(week1.length).toBe(7);
    expect(week1.every((m) => m.rateCents === 11500)).toBe(true);
  });

  it("parses key contacts and stops at the BILLING DETAILS block", () => {
    expect(parsed.contacts.length).toBe(8);
    expect(parsed.contacts.some((c) => /Optus Stadium/i.test(c.company ?? ""))).toBe(true);
    // the billing banner + its labelled rows must never leak in as contacts
    for (const c of parsed.contacts) {
      expect(c.name ?? "").not.toMatch(/billing details/i);
      expect(c.name ?? "").not.toMatch(/^(Name|Company|Postal|Address|ABN):$/);
    }
  });

  it("parses the billing block separately (blank in this workbook)", () => {
    // every billing value cell is empty in the template, so no profile is derived
    expect(parsed.billing).toBeNull();
  });

  it("skips SITE MAP title/header rows (sheet has no data rows)", () => {
    expect(parsed.siteMaps).toEqual([]);
  });
});
