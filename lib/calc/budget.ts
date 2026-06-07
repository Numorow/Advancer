/**
 * Budget rollups — typed replacements for the workbook's ESTIMATE/BUDGET
 * formulas (which currently carry #REF! errors).
 *
 * The workbook mixes ex-GST quotes and inc-GST actuals, so variance is
 * computed on a common inc-GST basis: actual inc-GST minus quoted inc-GST.
 * A positive variance means actuals are running over the quoted budget.
 */
import { gstFromExCents } from "./money";

export interface BudgetLine {
  quotedExGstCents: number;
  actualIncGstCents: number;
  approvalStatus?: "pending" | "approved" | "rejected";
  paymentStatus?: "unpaid" | "partial" | "paid";
}

export interface BudgetRollup {
  count: number;
  quotedExGstCents: number;
  quotedGstCents: number;
  quotedIncGstCents: number;
  actualIncGstCents: number;
  /** actual inc-GST − quoted inc-GST (positive = over budget). */
  varianceCents: number;
  /** Quoted ex-GST of approved lines only. */
  committedExGstCents: number;
  /** Inc-GST actuals of paid lines only. */
  paidIncGstCents: number;
}

export function rollupBudget(items: BudgetLine[]): BudgetRollup {
  const quotedExGstCents = sum(items, (i) => i.quotedExGstCents);
  const actualIncGstCents = sum(items, (i) => i.actualIncGstCents);
  const quotedGstCents = gstFromExCents(quotedExGstCents);
  const quotedIncGstCents = quotedExGstCents + quotedGstCents;
  const committedExGstCents = sum(
    items.filter((i) => i.approvalStatus === "approved"),
    (i) => i.quotedExGstCents,
  );
  const paidIncGstCents = sum(
    items.filter((i) => i.paymentStatus === "paid"),
    (i) => i.actualIncGstCents,
  );
  return {
    count: items.length,
    quotedExGstCents,
    quotedGstCents,
    quotedIncGstCents,
    actualIncGstCents,
    varianceCents: actualIncGstCents - quotedIncGstCents,
    committedExGstCents,
    paidIncGstCents,
  };
}

export interface CategoryRollup<T extends BudgetLine = BudgetLine> {
  key: string;
  items: T[];
  rollup: BudgetRollup;
}

/** Group lines by a category key and roll each group up. */
export function rollupByCategory<T extends BudgetLine>(
  items: T[],
  keyOf: (item: T) => string,
): CategoryRollup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const arr = groups.get(k);
    if (arr) arr.push(item);
    else groups.set(k, [item]);
  }
  return [...groups.entries()].map(([key, groupItems]) => ({
    key,
    items: groupItems,
    rollup: rollupBudget(groupItems),
  }));
}

function sum<T>(items: T[], pick: (item: T) => number | null | undefined): number {
  return items.reduce((acc, item) => acc + (pick(item) ?? 0), 0);
}
