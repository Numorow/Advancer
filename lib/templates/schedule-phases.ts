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
