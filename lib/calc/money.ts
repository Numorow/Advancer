/**
 * Money + GST helpers. All amounts are integer cents. GST = Australian 10%.
 * These replace the workbook's spreadsheet formulas with typed, tested logic.
 */
export const GST_RATE = 0.1;

/** GST component (cents) of an ex-GST amount. */
export function gstFromExCents(exCents: number): number {
  return Math.round(exCents * GST_RATE);
}

/** Inc-GST total (cents) from an ex-GST amount. */
export function incFromExCents(exCents: number): number {
  return exCents + gstFromExCents(exCents);
}

/** Ex-GST amount (cents) from an inc-GST total. */
export function exFromIncCents(incCents: number): number {
  return Math.round(incCents / (1 + GST_RATE));
}

/** GST component (cents) of an inc-GST total. */
export function gstFromIncCents(incCents: number): number {
  return incCents - exFromIncCents(incCents);
}

/**
 * Parse a dollar amount (string or number) into integer cents.
 * Strips currency symbols / thousands separators. Returns null for blanks,
 * spreadsheet error strings (#REF!, #VALUE! …) and anything non-numeric —
 * never NaN.
 */
export function dollarsToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  // Reject spreadsheet error strings (#REF!, #DIV/0! …) and any text — these
  // can contain stray digits ("#DIV/0!") that must NOT parse to a number.
  if (/[a-zA-Z#/]/.test(input)) return null;
  const cleaned = input.replace(/[^0-9.\-]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Format integer cents as AUD. `showSign` prefixes a + on positive values. */
export function formatCents(
  cents: number | null | undefined,
  opts?: { showSign?: boolean },
): string {
  const v = (cents ?? 0) / 100;
  const s = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(v);
  return opts?.showSign && v > 0 ? `+${s}` : s;
}
