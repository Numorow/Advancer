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
