/**
 * RFQ quote comparison. Recipients carry an optional quoted ex-GST amount
 * (cents). The comparison surfaces the best (lowest) responded quote and the
 * spread, guarding the no-quotes case with null (never NaN / Infinity).
 */
export interface QuoteRecipient {
  id?: string;
  quotedExGstCents: number | null;
}

export interface QuoteComparison {
  /** total recipients (sent to). */
  count: number;
  /** recipients with a non-null quote. */
  responded: number;
  /** id of the lowest-quoted recipient, or null. */
  bestId: string | null;
  /** lowest quoted ex-GST cents, or null when no quotes. */
  bestCents: number | null;
  /** highest quoted ex-GST cents, or null when no quotes. */
  highestCents: number | null;
  /** highest − best (potential saving vs the dearest quote), or null. */
  spreadCents: number | null;
}

export function compareQuotes(recipients: QuoteRecipient[]): QuoteComparison {
  const quoted = recipients.filter(
    (r): r is QuoteRecipient & { quotedExGstCents: number } =>
      typeof r.quotedExGstCents === "number" && Number.isFinite(r.quotedExGstCents),
  );

  if (quoted.length === 0) {
    return {
      count: recipients.length,
      responded: 0,
      bestId: null,
      bestCents: null,
      highestCents: null,
      spreadCents: null,
    };
  }

  let best = quoted[0];
  let highest = quoted[0];
  for (const r of quoted) {
    if (r.quotedExGstCents < best.quotedExGstCents) best = r;
    if (r.quotedExGstCents > highest.quotedExGstCents) highest = r;
  }

  return {
    count: recipients.length,
    responded: quoted.length,
    bestId: best.id ?? null,
    bestCents: best.quotedExGstCents,
    highestCents: highest.quotedExGstCents,
    spreadCents: highest.quotedExGstCents - best.quotedExGstCents,
  };
}

/** Is this recipient the (or a) best quote? False when there are no quotes. */
export function isBestQuote(
  recipientId: string | undefined,
  comparison: QuoteComparison,
): boolean {
  return (
    comparison.bestCents !== null &&
    recipientId !== undefined &&
    recipientId === comparison.bestId
  );
}
