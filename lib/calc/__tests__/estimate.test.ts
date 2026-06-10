import { describe, it, expect } from "vitest";
import {
  estimateTotals,
  estimateVsBudget,
  rollupEstimateSections,
  type EstimateLine,
} from "../estimate";

const line = (
  section: string,
  estimate: number,
  quote: number | null = null,
  reduction: number | null = null,
): EstimateLine => ({
  section,
  estimateExGstCents: estimate,
  quoteExGstCents: quote,
  possibleReductionCents: reduction,
});

describe("rollupEstimateSections", () => {
  it("groups by section preserving first-seen order", () => {
    const rows = rollupEstimateSections([
      line("Infrastructure", 100_00, 80_00),
      line("Staging / AV", 50_00),
      line("Infrastructure", 25_00, null, 10_00),
    ]);
    expect(rows.map((r) => r.section)).toEqual(["Infrastructure", "Staging / AV"]);
    expect(rows[0]).toMatchObject({
      count: 2,
      estimateExGstCents: 125_00,
      quoteExGstCents: 80_00,
      possibleReductionCents: 10_00,
    });
  });
});

describe("estimateTotals", () => {
  it("reproduces the workbook grand totals (ex → GST → inc)", () => {
    // ESTIMATE sheet: 356,617.00 estimate ex GST → 392,278.70 inc;
    // quote 232,364.00 ex → 255,600.40 inc.
    const t = estimateTotals([
      line("Infrastructure", 151_000_00, 103_206_00),
      line("Operations / Logistics", 51_612_00, 52_658_00),
      line("Staging / AV", 55_505_00, 39_000_00),
      line("Programming / Performers", 98_500_00, 37_500_00),
    ]);
    expect(t.estimateExGstCents).toBe(356_617_00);
    expect(t.estimateGstCents).toBe(35_661_70);
    expect(t.estimateIncGstCents).toBe(392_278_70);
    expect(t.quoteExGstCents).toBe(232_364_00);
    expect(t.quoteIncGstCents).toBe(255_600_40);
  });

  it("scenario total subtracts all possible reductions", () => {
    const t = estimateTotals([
      line("A", 100_00, null, 30_00),
      line("A", 50_00),
    ]);
    expect(t.possibleReductionCents).toBe(30_00);
    expect(t.scenarioExGstCents).toBe(120_00);
    expect(t.scenarioIncGstCents).toBe(132_00);
  });

  it("handles the empty estimate", () => {
    const t = estimateTotals([]);
    expect(t.estimateIncGstCents).toBe(0);
    expect(t.scenarioIncGstCents).toBe(0);
  });
});

describe("estimateVsBudget", () => {
  it("computes signed variance against budget quoted and actual", () => {
    const v = estimateVsBudget(
      { estimateIncGstCents: 392_278_70 },
      { quotedIncGstCents: 255_600_40, actualIncGstCents: 0 },
    );
    expect(v.quotedVarianceCents).toBe(-136_678_30);
    expect(v.actualVarianceCents).toBe(-392_278_70);
  });
});
