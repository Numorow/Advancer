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
