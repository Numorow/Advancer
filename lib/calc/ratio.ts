/**
 * Guarded ratio helpers. The workbook's TOILET RATIO CALC!F10 currently shows
 * #DIV/0!. In Advancer a zero denominator is a typed null, never an error
 * value — callers render "n/a" instead of crashing.
 */

/** Safe division: returns null when the denominator is zero / non-finite. */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * People-per-pan capacity ratio. Returns null when there are no pans (instead
 * of the spreadsheet's #DIV/0!). Used by the future Toilet Ratio module; the
 * guard pattern is established and tested now.
 */
export function capacityRatio(people: number, pans: number): number | null {
  if (pans <= 0) return null;
  return safeRatio(people, pans);
}
