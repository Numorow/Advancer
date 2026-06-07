/**
 * Crew labour costing. Replaces the CREW SCHEDULE sheet's per-shift and daily
 * total formulas (one of which, K5, currently shows #N/A from a missing rate
 * lookup). Cost = effective hours × rate; a missing rate falls back to 0 cost
 * rather than erroring. GST = Australian 10%.
 */
import { gstFromExCents } from "./money";

export interface CrewShiftLite {
  actualHours: number | null;
  scheduledHours: number | null;
  rateCents: number | null;
}

/** Actual hours when present, else scheduled, else 0. */
export function effectiveHours(s: CrewShiftLite): number {
  const h = s.actualHours ?? s.scheduledHours ?? 0;
  return Number.isFinite(h) ? h : 0;
}

/** Cost in cents for a shift. Missing/!finite rate → 0 (the #N/A fallback). */
export function shiftCostCents(s: CrewShiftLite): number {
  const rate = s.rateCents;
  if (rate == null || !Number.isFinite(rate)) return 0;
  return Math.round(effectiveHours(s) * rate);
}

export interface CrewRollup {
  shifts: number;
  scheduledHours: number;
  actualHours: number;
  exGstCents: number;
  gstCents: number;
  incGstCents: number;
}

export function rollupCrew(shifts: CrewShiftLite[]): CrewRollup {
  const scheduledHours = round2(sum(shifts, (s) => s.scheduledHours ?? 0));
  const actualHours = round2(sum(shifts, (s) => s.actualHours ?? 0));
  const exGstCents = shifts.reduce((acc, s) => acc + shiftCostCents(s), 0);
  const gstCents = gstFromExCents(exGstCents);
  return {
    shifts: shifts.length,
    scheduledHours,
    actualHours,
    exGstCents,
    gstCents,
    incGstCents: exGstCents + gstCents,
  };
}

export interface CrewGroup<T extends CrewShiftLite = CrewShiftLite> {
  key: string;
  shifts: T[];
  rollup: CrewRollup;
}

/** Group shifts by a key (day or role) and roll each up. Preserves first-seen order. */
export function rollupCrewBy<T extends CrewShiftLite>(
  shifts: T[],
  keyOf: (s: T) => string,
): CrewGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const s of shifts) {
    const k = keyOf(s);
    const arr = groups.get(k);
    if (arr) arr.push(s);
    else groups.set(k, [s]);
  }
  return [...groups.entries()].map(([key, groupShifts]) => ({
    key,
    shifts: groupShifts,
    rollup: rollupCrew(groupShifts),
  }));
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + (pick(item) || 0), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
