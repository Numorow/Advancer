import { describe, it, expect } from "vitest";
import { compareQuotes, isBestQuote } from "../rfq";

describe("RFQ quote comparison", () => {
  it("returns nulls when no recipients have quoted", () => {
    const c = compareQuotes([
      { id: "a", quotedExGstCents: null },
      { id: "b", quotedExGstCents: null },
    ]);
    expect(c.count).toBe(2);
    expect(c.responded).toBe(0);
    expect(c.bestId).toBeNull();
    expect(c.bestCents).toBeNull();
    expect(c.spreadCents).toBeNull();
    expect(isBestQuote("a", c)).toBe(false);
  });

  it("handles an empty list", () => {
    const c = compareQuotes([]);
    expect(c.count).toBe(0);
    expect(c.responded).toBe(0);
    expect(c.bestCents).toBeNull();
  });

  it("picks the single quote as best with zero spread", () => {
    const c = compareQuotes([
      { id: "a", quotedExGstCents: 500000 },
      { id: "b", quotedExGstCents: null },
    ]);
    expect(c.responded).toBe(1);
    expect(c.bestId).toBe("a");
    expect(c.bestCents).toBe(500000);
    expect(c.highestCents).toBe(500000);
    expect(c.spreadCents).toBe(0);
    expect(isBestQuote("a", c)).toBe(true);
    expect(isBestQuote("b", c)).toBe(false);
  });

  it("finds the lowest quote and the spread", () => {
    const c = compareQuotes([
      { id: "a", quotedExGstCents: 800000 },
      { id: "b", quotedExGstCents: 500000 },
      { id: "c", quotedExGstCents: 650000 },
      { id: "d", quotedExGstCents: null },
    ]);
    expect(c.count).toBe(4);
    expect(c.responded).toBe(3);
    expect(c.bestId).toBe("b");
    expect(c.bestCents).toBe(500000);
    expect(c.highestCents).toBe(800000);
    expect(c.spreadCents).toBe(300000);
  });

  it("keeps the first on a tie and reports zero spread when all equal", () => {
    const c = compareQuotes([
      { id: "a", quotedExGstCents: 500000 },
      { id: "b", quotedExGstCents: 500000 },
    ]);
    expect(c.bestId).toBe("a");
    expect(c.spreadCents).toBe(0);
  });

  it("ignores non-finite quotes", () => {
    const c = compareQuotes([
      { id: "a", quotedExGstCents: Infinity },
      { id: "b", quotedExGstCents: 100000 },
    ]);
    expect(c.responded).toBe(1);
    expect(c.bestId).toBe("b");
  });
});
