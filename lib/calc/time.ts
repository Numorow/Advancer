/**
 * Time + date normalisation. The workbook stores times as a mix of strings
 * ("8:00AM"), Excel day-fractions (0.5), and integer clock values (700, 1800).
 * These helpers turn all of them into a typed 24h "HH:MM" string (or null),
 * and Excel serial dates into JS Dates / ISO "YYYY-MM-DD".
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmt(h: number, m: number): string | null {
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

/** 700 -> "07:00", 1800 -> "18:00", 30 -> "00:30". */
function clockIntToTime(n: number): string | null {
  const h = Math.floor(n / 100);
  const m = n % 100;
  return fmt(h, m);
}

export function parseWorkbookTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    // Excel time-only values arrive as Dates near the epoch; read UTC parts to
    // avoid a timezone shift moving the clock time.
    return fmt(value.getUTCHours(), value.getUTCMinutes());
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Day fraction (possibly with a whole-day part): the fractional portion is
    // the time of day.
    if (value > 0 && value < 1) {
      const totalMin = Math.round(value * 24 * 60);
      return fmt(Math.floor(totalMin / 60) % 24, totalMin % 60);
    }
    if (value >= 1 && value % 1 !== 0) {
      const totalMin = Math.round((value % 1) * 24 * 60);
      return fmt(Math.floor(totalMin / 60) % 24, totalMin % 60);
    }
    // Integer clock value: 0..2359.
    const n = Math.trunc(value);
    if (n >= 0 && n <= 2359) return clockIntToTime(n);
    return null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (s === "") return null;

    const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
      const isPm = /p/i.test(ampm[3]);
      if (h === 12) h = 0;
      if (isPm) h += 12;
      return fmt(h % 24, m);
    }

    const hm = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) return fmt(parseInt(hm[1], 10), parseInt(hm[2], 10));

    const clockInt = s.match(/^(\d{3,4})$/);
    if (clockInt) return clockIntToTime(parseInt(clockInt[1], 10));

    const hourOnly = s.match(/^(\d{1,2})$/);
    if (hourOnly) return fmt(parseInt(hourOnly[1], 10), 0);

    return null;
  }

  return null;
}

/** Excel serial date (1900 system) or Date/ISO string -> JS Date (UTC). */
export function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel epoch is 1899-12-30; 25569 days from there to the Unix epoch.
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (s === "") return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Format a Date as ISO "YYYY-MM-DD" using its UTC parts. */
export function toISODate(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
