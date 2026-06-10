/**
 * Management labour costing. Mirrors the MGMT SCHEDULE sheet: weekly task
 * blocks, each task = hours × the week's rate. GST = Australian 10%.
 */
import { gstFromExCents } from "./money";

export interface ManagementTaskLite {
  hours: number | null;
  rateCents: number | null;
  completed: boolean;
}

/** Task cost in cents; missing hours or rate → 0. */
export function taskCostCents(hours: number | null, rateCents: number | null): number {
  if (rateCents == null || !Number.isFinite(rateCents)) return 0;
  if (hours == null || !Number.isFinite(hours)) return 0;
  return Math.round(hours * rateCents);
}

export interface ManagementRollup {
  tasks: number;
  completedTasks: number;
  pct: number;
  hours: number;
  exGstCents: number;
  gstCents: number;
  incGstCents: number;
}

export function rollupManagement(tasks: ManagementTaskLite[]): ManagementRollup {
  const hours = round2(tasks.reduce((a, t) => a + (t.hours ?? 0), 0));
  const exGstCents = tasks.reduce((a, t) => a + taskCostCents(t.hours, t.rateCents), 0);
  const gstCents = gstFromExCents(exGstCents);
  const completedTasks = tasks.filter((t) => t.completed).length;
  return {
    tasks: tasks.length,
    completedTasks,
    pct: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
    hours,
    exGstCents,
    gstCents,
    incGstCents: exGstCents + gstCents,
  };
}

export interface ManagementGroup<T extends ManagementTaskLite = ManagementTaskLite> {
  key: string;
  tasks: T[];
  rollup: ManagementRollup;
}

export function rollupManagementBy<T extends ManagementTaskLite>(
  tasks: T[],
  keyOf: (t: T) => string,
): ManagementGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const t of tasks) {
    const k = keyOf(t);
    const arr = groups.get(k);
    if (arr) arr.push(t);
    else groups.set(k, [t]);
  }
  return [...groups.entries()].map(([key, groupTasks]) => ({
    key,
    tasks: groupTasks,
    rollup: rollupManagement(groupTasks),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ISO date of the Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const dow = d.getUTCDay(); // 0 Sun … 6 Sat
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Mondays of every week from the week containing `fromISO` through the week
 * containing `toISO` (inclusive). Seeds the management page's week headings.
 * Capped at 52 weeks as a runaway guard.
 */
export function weekMondays(fromISO: string, toISO: string): string[] {
  const start = mondayOf(fromISO);
  const end = mondayOf(toISO);
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(cur.getTime())) return out;
  while (out.length < 52) {
    const iso = cur.toISOString().slice(0, 10);
    if (iso > end) break;
    out.push(iso);
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return out;
}
