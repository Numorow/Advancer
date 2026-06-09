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

/* ------------------------------------------------------------ workflow status */

export type RfqWorkflowStatus =
  | "draft"
  | "sent"
  | "responded"
  | "awarded"
  | "declined"
  | "cancelled";

export interface RecipientStatusLite {
  status: "pending" | "sent" | "responded" | "declined";
  quotedExGstCents?: number | null;
}

/**
 * Derive the RFQ workflow status from its recipients, so the header status stays
 * in lock-step with what's actually happened without manual fiddling:
 *   - `awarded`   once a recipient is awarded;
 *   - `responded` if any recipient has responded / returned a quote;
 *   - `sent`      if any recipient has been sent it;
 *   - `draft`     otherwise.
 * The manual terminal states `declined` / `cancelled` are never overridden — those
 * are deliberate decisions, not a function of recipient activity.
 */
export function deriveRfqStatus(
  recipients: RecipientStatusLite[],
  awardedRecipientId: string | null,
  currentStatus: RfqWorkflowStatus,
): RfqWorkflowStatus {
  if (currentStatus === "declined" || currentStatus === "cancelled") return currentStatus;
  if (awardedRecipientId) return "awarded";
  const responded = recipients.some(
    (r) => r.status === "responded" || (r.quotedExGstCents != null && Number.isFinite(r.quotedExGstCents)),
  );
  if (responded) return "responded";
  if (recipients.some((r) => r.status === "sent")) return "sent";
  return "draft";
}

/* ------------------------------------------------------- itemised quote grid */

export interface LineQuoteCell {
  recipientId: string;
  itemId: string;
  lineTotalCents: number | null;
}

export interface LineQuoteComparison {
  /** lowest line total per item id (with the recipient holding it), or null when none quoted. */
  bestByItem: Record<string, { cents: number; recipientId: string } | null>;
  /** sum of a recipient's non-null line totals. */
  totalsByRecipient: Record<string, number>;
  /** recipient with the lowest summed line total (only those who quoted ≥1 line), or null. */
  bestTotalRecipientId: string | null;
}

function isFiniteCents(c: number | null): c is number {
  return typeof c === "number" && Number.isFinite(c);
}

/**
 * Build the side-by-side comparison for the itemised grid: best (lowest) price per
 * line, each recipient's line-sum, and the cheapest recipient overall. Guards the
 * no-quotes case with null (never NaN / Infinity).
 */
export function compareLineQuotes(
  itemIds: string[],
  recipientIds: string[],
  cells: LineQuoteCell[],
): LineQuoteComparison {
  const bestByItem: Record<string, { cents: number; recipientId: string } | null> = {};
  for (const itemId of itemIds) {
    let best: { cents: number; recipientId: string } | null = null;
    for (const cell of cells) {
      if (cell.itemId !== itemId || !isFiniteCents(cell.lineTotalCents)) continue;
      if (best === null || cell.lineTotalCents < best.cents) {
        best = { cents: cell.lineTotalCents, recipientId: cell.recipientId };
      }
    }
    bestByItem[itemId] = best;
  }

  const totalsByRecipient: Record<string, number> = {};
  const quotedSomething = new Set<string>();
  for (const recipientId of recipientIds) totalsByRecipient[recipientId] = 0;
  for (const cell of cells) {
    if (!isFiniteCents(cell.lineTotalCents)) continue;
    if (!(cell.recipientId in totalsByRecipient)) totalsByRecipient[cell.recipientId] = 0;
    totalsByRecipient[cell.recipientId] += cell.lineTotalCents;
    quotedSomething.add(cell.recipientId);
  }

  let bestTotalRecipientId: string | null = null;
  let bestTotal = Infinity;
  for (const recipientId of recipientIds) {
    if (!quotedSomething.has(recipientId)) continue;
    if (totalsByRecipient[recipientId] < bestTotal) {
      bestTotal = totalsByRecipient[recipientId];
      bestTotalRecipientId = recipientId;
    }
  }

  return { bestByItem, totalsByRecipient, bestTotalRecipientId };
}
