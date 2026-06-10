/**
 * Turn a new event's Bump-in / Event / Bump-out date ranges into master-schedule
 * entries — one per day, tagged by phase. Used by the "Create new event" form to
 * auto-populate the schedule. Pure + tested.
 */
export interface PhaseRange {
  from: string | null;
  to: string | null;
}
export interface PhaseInput {
  bumpIn: PhaseRange;
  eventDays: PhaseRange;
  bumpOut: PhaseRange;
}
export interface PhaseEntry {
  date: string;
  type: string;
  action: string;
}

/** Inclusive list of ISO days from `from` to `to` (single day if `to` is empty). */
export function expandDays(from: string | null, to: string | null): string[] {
  if (!from) return [];
  const start = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];
  const endStr = to && to >= from ? to : from;
  const end = new Date(`${endStr}T00:00:00Z`);
  const days: string[] = [];
  let cursor = start.getTime();
  const endMs = end.getTime();
  let guard = 0;
  while (cursor <= endMs && guard < 400) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
    guard += 1;
  }
  return days;
}

const PHASES: { key: keyof PhaseInput; type: string; label: string }[] = [
  { key: "bumpIn", type: "ON_SITE", label: "Bump-in" },
  { key: "eventDays", type: "SHOW_TIME", label: "Event Day" },
  { key: "bumpOut", type: "BUMP_OUT", label: "Bump-out" },
];

/** One schedule entry per phase day, sorted by date. */
export function phaseScheduleEntries(input: PhaseInput): PhaseEntry[] {
  const out: PhaseEntry[] = [];
  for (const phase of PHASES) {
    const days = expandDays(input[phase.key].from, input[phase.key].to);
    days.forEach((date, i) => {
      out.push({
        date,
        type: phase.type,
        action: days.length > 1 ? `${phase.label} — Day ${i + 1}` : phase.label,
      });
    });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ------------------------------------------------------ regeneration + derivation */

function rangeEnd(r: PhaseRange): string | null {
  if (!r.from) return null;
  return r.to && r.to >= r.from ? r.to : r.from;
}
function inRange(date: string, r: PhaseRange): boolean {
  const end = rangeEnd(r);
  return r.from != null && end != null && date >= r.from && date <= end;
}

export interface AutoEntryLite {
  id: string;
  date: string | null;
  type: string | null;
}

/**
 * Plan a schedule regeneration: given the existing **auto-generated** phase rows and
 * the freshly-desired phase days, return which auto rows to delete and which to
 * insert. Surviving days (same date+type) are left in place, so user-added times /
 * details on a phase day are preserved across a dates edit.
 */
export function regenPlan(
  existingAuto: AutoEntryLite[],
  desired: PhaseEntry[],
): { toDeleteIds: string[]; toInsert: PhaseEntry[] } {
  const key = (date: string | null, type: string | null) => `${date ?? ""}|${type ?? ""}`;
  const desiredKeys = new Set(desired.map((d) => key(d.date, d.type)));
  const existingKeys = new Set(existingAuto.map((e) => key(e.date, e.type)));
  return {
    toDeleteIds: existingAuto.filter((e) => !desiredKeys.has(key(e.date, e.type))).map((e) => e.id),
    toInsert: desired.filter((d) => !existingKeys.has(key(d.date, d.type))),
  };
}

/** Which phase a date falls in (Bump-in → Event Day → Bump-out priority), or null. */
export function phaseForDate(date: string, phases: PhaseInput): "Bump-in" | "Event Day" | "Bump-out" | null {
  if (inRange(date, phases.bumpIn)) return "Bump-in";
  if (inRange(date, phases.eventDays)) return "Event Day";
  if (inRange(date, phases.bumpOut)) return "Bump-out";
  return null;
}

/** Distinct, sorted onsite days from the schedule, each labelled by its phase. */
export function deriveEventDays(
  scheduleDates: (string | null)[],
  phases: PhaseInput,
): { date: string; label: string }[] {
  const distinct = [...new Set(scheduleDates.filter((d): d is string => Boolean(d)))].sort();
  return distinct.map((date) => ({ date, label: phaseForDate(date, phases) ?? "" }));
}

/** The event's overall span: earliest phase start → latest phase end (or nulls). */
export function eventSpan(phases: PhaseInput): { start: string | null; end: string | null } {
  const ranges = [phases.bumpIn, phases.eventDays, phases.bumpOut];
  const starts = ranges.map((r) => r.from).filter((d): d is string => Boolean(d));
  const ends = ranges.map(rangeEnd).filter((d): d is string => Boolean(d));
  return {
    start: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null,
    end: ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null,
  };
}
