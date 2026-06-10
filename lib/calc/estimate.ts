/**
 * Estimate engine — typed replacements for the workbook ESTIMATE sheet.
 * The estimate is a coarse, early-stage layer compared against the detailed
 * budget's quoted/actual totals. All amounts are ex-GST integer cents unless
 * a name says otherwise; the sheet's broken subtotal formulas (#REF!) are
 * recomputed here, never migrated.
 */
import { gstFromExCents, incFromExCents } from "./money";
import type { BudgetRollup } from "./budget";

export interface EstimateLine {
  section: string;
  estimateExGstCents: number;
  quoteExGstCents: number | null;
  possibleReductionCents: number | null;
}

export interface EstimateSectionRollup {
  section: string;
  count: number;
  estimateExGstCents: number;
  quoteExGstCents: number;
  possibleReductionCents: number;
}

/** Per-section subtotals, preserving first-seen section order. */
export function rollupEstimateSections(lines: EstimateLine[]): EstimateSectionRollup[] {
  const order: string[] = [];
  const map = new Map<string, EstimateSectionRollup>();
  for (const l of lines) {
    let r = map.get(l.section);
    if (!r) {
      r = { section: l.section, count: 0, estimateExGstCents: 0, quoteExGstCents: 0, possibleReductionCents: 0 };
      map.set(l.section, r);
      order.push(l.section);
    }
    r.count += 1;
    r.estimateExGstCents += l.estimateExGstCents;
    r.quoteExGstCents += l.quoteExGstCents ?? 0;
    r.possibleReductionCents += l.possibleReductionCents ?? 0;
  }
  return order.map((s) => map.get(s)!);
}

export interface EstimateTotals {
  estimateExGstCents: number;
  estimateGstCents: number;
  estimateIncGstCents: number;
  quoteExGstCents: number;
  quoteGstCents: number;
  quoteIncGstCents: number;
  possibleReductionCents: number;
  /** Estimate with every flagged reduction taken, ex GST. */
  scenarioExGstCents: number;
  scenarioIncGstCents: number;
}

export function estimateTotals(lines: EstimateLine[]): EstimateTotals {
  const estimateEx = lines.reduce((a, l) => a + l.estimateExGstCents, 0);
  const quoteEx = lines.reduce((a, l) => a + (l.quoteExGstCents ?? 0), 0);
  const reduction = lines.reduce((a, l) => a + (l.possibleReductionCents ?? 0), 0);
  const scenarioEx = estimateEx - reduction;
  return {
    estimateExGstCents: estimateEx,
    estimateGstCents: gstFromExCents(estimateEx),
    estimateIncGstCents: incFromExCents(estimateEx),
    quoteExGstCents: quoteEx,
    quoteGstCents: gstFromExCents(quoteEx),
    quoteIncGstCents: incFromExCents(quoteEx),
    possibleReductionCents: reduction,
    scenarioExGstCents: scenarioEx,
    scenarioIncGstCents: incFromExCents(scenarioEx),
  };
}

export interface EstimateVsBudget {
  estimateIncGstCents: number;
  budgetQuotedIncGstCents: number;
  budgetActualIncGstCents: number;
  /** Budget quoted inc-GST minus the estimate (negative = under estimate). */
  quotedVarianceCents: number;
  /** Budget actual inc-GST minus the estimate (negative = under estimate). */
  actualVarianceCents: number;
}

/** Compare the estimate's inc-GST total against the live budget rollup. */
export function estimateVsBudget(
  totals: Pick<EstimateTotals, "estimateIncGstCents">,
  budget: Pick<BudgetRollup, "quotedIncGstCents" | "actualIncGstCents">,
): EstimateVsBudget {
  return {
    estimateIncGstCents: totals.estimateIncGstCents,
    budgetQuotedIncGstCents: budget.quotedIncGstCents,
    budgetActualIncGstCents: budget.actualIncGstCents,
    quotedVarianceCents: budget.quotedIncGstCents - totals.estimateIncGstCents,
    actualVarianceCents: budget.actualIncGstCents - totals.estimateIncGstCents,
  };
}
