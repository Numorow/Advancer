/** Shared types + type metadata for the schedule grid and timeline views. */

export interface ScheduleRow {
  id: string;
  eventDate: string | null;
  startTime: string | null;
  finishTime: string | null;
  type: string | null;
  supplierId: string | null;
  supplierText: string | null;
  supplierName: string | null;
  action: string | null;
  location: string | null;
  sitePoc: string | null;
  notes: string | null;
  completed: boolean;
  criticalPath: boolean;
  sort: number;
}

export interface SupplierOpt {
  id: string;
  name: string;
}

export const TYPE_LABELS: Record<string, string> = {
  ON_SITE: "On-site",
  INSTALL: "Install",
  COLLECTION: "Collection",
  DELIVERY: "Delivery",
  SHOW_TIME: "Show time",
  BUMP_OUT: "Bump out",
  DROP_OFF: "Drop off",
  PICK_UP: "Pick up",
  SECURITY: "Security",
};

/** Tailwind background classes per schedule type — written as literals so the JIT
 *  scanner includes them (they're indexed dynamically at render time). */
export const TYPE_COLORS: Record<string, string> = {
  ON_SITE: "bg-sky-500",
  INSTALL: "bg-indigo-500",
  COLLECTION: "bg-amber-500",
  DELIVERY: "bg-emerald-500",
  SHOW_TIME: "bg-fuchsia-600",
  BUMP_OUT: "bg-rose-500",
  DROP_OFF: "bg-teal-500",
  PICK_UP: "bg-orange-500",
  SECURITY: "bg-slate-500",
};
export const TYPE_COLOR_DEFAULT = "bg-slate-400";

/** Badge-style chip classes per type — same hues as TYPE_COLORS, in the
 *  light/dark pattern of components/ui/badge.tsx. Literals for the JIT. */
export const TYPE_CHIP_CLASSES: Record<string, string> = {
  ON_SITE: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400",
  INSTALL: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-400",
  COLLECTION: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  DELIVERY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
  SHOW_TIME: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-400",
  BUMP_OUT: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400",
  DROP_OFF: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-400",
  PICK_UP: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-400",
  SECURITY: "bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300",
};

export function supplierLabel(row: ScheduleRow): string | null {
  return row.supplierName ?? row.supplierText ?? null;
}

export function formatDateLabel(iso: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Distinct event dates in chronological order (nulls/"Undated" last), each with its rows. */
export function groupByDate(rows: ScheduleRow[]): { date: string | null; rows: ScheduleRow[] }[] {
  const map = new Map<string, ScheduleRow[]>();
  for (const r of rows) {
    const key = r.eventDate ?? "￿"; // sort undated last
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return [...map.keys()]
    .sort()
    .map((key) => ({
      date: key === "￿" ? null : key,
      rows: (map.get(key) ?? []).slice().sort(byTimeThenSort),
    }));
}

function byTimeThenSort(a: ScheduleRow, b: ScheduleRow): number {
  const at = a.startTime ?? "99:99";
  const bt = b.startTime ?? "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.sort - b.sort;
}
