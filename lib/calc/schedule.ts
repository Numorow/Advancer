/**
 * Schedule timeline geometry — pure helpers for the day-by-day Gantt view.
 * Times are typed "HH:MM" strings (or null); these turn a day's entries into a
 * padded minute range and each entry into a left/width percentage bar, guarding
 * the no-times / zero-length cases so bars never overflow or vanish.
 */
const DEFAULT_START_MIN = 6 * 60; // 06:00
const DEFAULT_END_MIN = 22 * 60; // 22:00

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(n, hi));
}

/** "08:30" -> 510. Null/invalid -> null. */
export function hhmmToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

export interface TimedEntry {
  startTime: string | null;
  finishTime: string | null;
}

/** The minute window for a day's axis: min start → max finish, padded to whole
 *  hours. Falls back to a 06:00–22:00 default when the day has no times. */
export function dayRange(entries: TimedEntry[]): { startMin: number; endMin: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const e of entries) {
    const s = hhmmToMinutes(e.startTime);
    const f = hhmmToMinutes(e.finishTime);
    if (s != null) {
      min = Math.min(min, s);
      max = Math.max(max, s);
    }
    if (f != null) {
      min = Math.min(min, f);
      max = Math.max(max, f);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { startMin: DEFAULT_START_MIN, endMin: DEFAULT_END_MIN };
  }
  const startMin = Math.floor(min / 60) * 60;
  let endMin = Math.ceil(max / 60) * 60;
  if (endMin <= startMin) endMin = startMin + 60;
  return { startMin, endMin };
}

/** Left + width percentages for an entry's bar within the day range, or null when
 *  it has no start time. Zero-length (no finish) bars keep a minimum visible width. */
export function barGeometry(
  startMin: number | null,
  finishMin: number | null,
  range: { startMin: number; endMin: number },
): { leftPct: number; widthPct: number } | null {
  if (startMin == null) return null;
  const span = range.endMin - range.startMin;
  if (span <= 0) return null;
  const start = clamp(startMin, range.startMin, range.endMin);
  const end =
    finishMin != null && finishMin > startMin ? clamp(finishMin, range.startMin, range.endMin) : start;
  const leftPct = clamp(((start - range.startMin) / span) * 100, 0, 100);
  let widthPct = Math.max(((end - start) / span) * 100, 1.5);
  if (leftPct + widthPct > 100) widthPct = Math.max(100 - leftPct, 1.5);
  return { leftPct, widthPct };
}

/** Whole-hour tick marks (in minutes) across a day range, for the axis labels. */
export function hourTicks(range: { startMin: number; endMin: number }): number[] {
  const ticks: number[] = [];
  for (let m = range.startMin; m <= range.endMin; m += 60) ticks.push(m);
  return ticks;
}

/** 510 -> "08:00" (tick label). */
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}
