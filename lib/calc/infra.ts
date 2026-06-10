/**
 * Infrastructure calculations. Fencing total metres (length + mitigation) and
 * the toilet ratio summary — the latter replaces TOILET RATIO CALC!F10's
 * #DIV/0! with a guarded null (via capacityRatio).
 */
import { capacityRatio } from "./ratio";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Fencing total run = length + mitigation (metres). */
export function fencingTotalM(lengthM: number | null, mitigationM: number | null): number {
  return round2((lengthM ?? 0) + (mitigationM ?? 0));
}

export interface ToiletLine {
  quantity: number | null;
  pans: number | null;
}

export interface ToiletAreaSummary {
  totalQuantity: number;
  totalPans: number;
  capacity: number | null;
  ratioTarget: number | null;
  /** People per pan, or null when there are no pans (guards #DIV/0!). */
  ratio: number | null;
  /** Whether the ratio meets the target (lower people-per-pan is better), or null. */
  meetsTarget: boolean | null;
}

export function toiletAreaSummary(
  lines: ToiletLine[],
  capacity: number | null,
  ratioTarget: number | null,
): ToiletAreaSummary {
  const totalPans = lines.reduce((acc, l) => acc + (l.pans ?? 0), 0);
  const totalQuantity = lines.reduce((acc, l) => acc + (l.quantity ?? 0), 0);
  const ratio = capacity != null ? capacityRatio(capacity, totalPans) : null;
  const meetsTarget = ratio != null && ratioTarget != null ? ratio <= ratioTarget : null;
  return { totalQuantity, totalPans, capacity, ratioTarget, ratio, meetsTarget };
}

/* -------------------------------------------------- per-register summaries */

/** Infra register rows are raw DB rows (snake_case keys); helpers read them directly. */
type Row = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);
const hasSupplier = (r: Row): boolean => Boolean(r.supplier_id);
function firstNonNull(values: (number | null)[]): number | null {
  for (const v of values) if (v != null) return v;
  return null;
}

export function fencingGrandTotalM(rows: Row[]): number {
  return round2(rows.reduce((a, r) => a + num(r.length_m) + num(r.mitigation_m), 0));
}

export function powerSummary(rows: Row[]) {
  return {
    items: rows.length,
    totalQty: rows.reduce((a, r) => a + num(r.quantity), 0),
    withSupplier: rows.filter(hasSupplier).length,
  };
}

export function structuresSummary(rows: Row[]) {
  return {
    count: rows.length,
    totalAreaM2: round2(rows.reduce((a, r) => a + num(r.length_m) * num(r.width_m), 0)),
    docs: rows.filter((r) => Boolean(r.docs_received)).length,
    signoff: rows.filter((r) => Boolean(r.engineer_signoff)).length,
    withSupplier: rows.filter(hasSupplier).length,
  };
}

export function furnitureSummary(rows: Row[]) {
  const bySupplier: Record<string, number> = {};
  const assets = new Set<string>();
  let totalQty = 0;
  for (const r of rows) {
    const q = num(r.quantity);
    totalQty += q;
    if (r.asset) assets.add(String(r.asset));
    const sid = r.supplier_id ? String(r.supplier_id) : "__none__";
    bySupplier[sid] = (bySupplier[sid] ?? 0) + q;
  }
  return { totalQty, assets: assets.size, withSupplier: rows.filter(hasSupplier).length, bySupplier };
}

export function transportSummary(rows: Row[]) {
  const byTruck: Record<string, number> = {};
  let incoming = 0;
  let outgoing = 0;
  for (const r of rows) {
    if (r.direction === "incoming") incoming += 1;
    else if (r.direction === "outgoing") outgoing += 1;
    const t = r.truck_type ? String(r.truck_type) : "—";
    byTruck[t] = (byTruck[t] ?? 0) + 1;
  }
  return { total: rows.length, incoming, outgoing, byTruck };
}

export function productionSummary(rows: Row[]) {
  const dates = rows
    .map((r) => r.item_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  return { count: rows.length, firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null };
}

/* ----------------------------------------------------- readiness composite */

function pct(a: number, b: number): number {
  return b ? Math.round((a / b) * 100) : 0;
}

export interface InfraReadinessTables {
  power: Row[];
  structures: Row[];
  fencing: Row[];
  furniture: Row[];
  toilets: Row[];
}

export interface InfraReadiness {
  score: number;
  parts: { label: string; pct: number; n: number }[];
}

/**
 * A transparent infrastructure-readiness score: the average of the *available*
 * signals — supplier coverage (across supplier-bearing registers), structures
 * engineer sign-off, and toilet ratios meeting target. Parts with no data are
 * skipped; no data at all → score 0 / empty parts.
 */
export function infraReadiness(t: InfraReadinessTables): InfraReadiness {
  const parts: InfraReadiness["parts"] = [];

  const supplierRows = [...t.power, ...t.structures, ...t.fencing, ...t.furniture];
  if (supplierRows.length) {
    parts.push({
      label: "Supplier coverage",
      pct: pct(supplierRows.filter(hasSupplier).length, supplierRows.length),
      n: supplierRows.length,
    });
  }
  if (t.structures.length) {
    parts.push({
      label: "Structures signed off",
      pct: pct(t.structures.filter((r) => Boolean(r.engineer_signoff)).length, t.structures.length),
      n: t.structures.length,
    });
  }

  const met: boolean[] = [];
  for (const area of ["General", "VIP"]) {
    const lines = t.toilets.filter((r) => (r.area ?? "") === area);
    if (!lines.length) continue;
    const capacity = firstNonNull(lines.map((l) => (l.capacity == null ? null : num(l.capacity))));
    const target = firstNonNull(lines.map((l) => (l.ratio_target == null ? null : num(l.ratio_target))));
    const s = toiletAreaSummary(
      lines.map((l) => ({
        quantity: l.quantity == null ? null : num(l.quantity),
        pans: l.pans == null ? null : num(l.pans),
      })),
      capacity,
      target,
    );
    if (s.meetsTarget != null) met.push(s.meetsTarget);
  }
  if (met.length) {
    parts.push({ label: "Toilet ratios met", pct: pct(met.filter(Boolean).length, met.length), n: met.length });
  }

  const score = parts.length ? Math.round(parts.reduce((a, p) => a + p.pct, 0) / parts.length) : 0;
  return { score, parts };
}
