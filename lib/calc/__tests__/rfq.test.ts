import { describe, it, expect } from "vitest";
import { compareQuotes, isBestQuote, deriveRfqStatus, compareLineQuotes } from "../rfq";

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

describe("deriveRfqStatus", () => {
  it("is draft with no recipient activity", () => {
    expect(deriveRfqStatus([], null, "draft")).toBe("draft");
    expect(deriveRfqStatus([{ status: "pending" }], null, "sent")).toBe("draft");
  });

  it("is sent once any recipient is sent", () => {
    expect(deriveRfqStatus([{ status: "pending" }, { status: "sent" }], null, "draft")).toBe("sent");
  });

  it("is responded when a recipient responds or returns a quote", () => {
    expect(deriveRfqStatus([{ status: "responded" }], null, "sent")).toBe("responded");
    expect(deriveRfqStatus([{ status: "sent", quotedExGstCents: 1234 }], null, "sent")).toBe("responded");
  });

  it("is awarded whenever an awarded recipient is set", () => {
    expect(deriveRfqStatus([{ status: "responded" }], "rec-1", "responded")).toBe("awarded");
  });

  it("never overrides the manual terminal states", () => {
    expect(deriveRfqStatus([{ status: "responded", quotedExGstCents: 99 }], null, "declined")).toBe("declined");
    expect(deriveRfqStatus([{ status: "sent" }], null, "cancelled")).toBe("cancelled");
  });
});

describe("compareLineQuotes", () => {
  const items = ["i1", "i2"];
  const recips = ["rA", "rB"];

  it("finds best per line, recipient sums, and cheapest overall", () => {
    const c = compareLineQuotes(items, recips, [
      { recipientId: "rA", itemId: "i1", lineTotalCents: 1000 },
      { recipientId: "rA", itemId: "i2", lineTotalCents: 3000 },
      { recipientId: "rB", itemId: "i1", lineTotalCents: 1200 },
      { recipientId: "rB", itemId: "i2", lineTotalCents: 2000 },
    ]);
    expect(c.bestByItem["i1"]).toEqual({ cents: 1000, recipientId: "rA" });
    expect(c.bestByItem["i2"]).toEqual({ cents: 2000, recipientId: "rB" });
    expect(c.totalsByRecipient).toEqual({ rA: 4000, rB: 3200 });
    expect(c.bestTotalRecipientId).toBe("rB");
  });

  it("ignores null line totals and handles a recipient with no quotes", () => {
    const c = compareLineQuotes(items, recips, [
      { recipientId: "rA", itemId: "i1", lineTotalCents: 500 },
      { recipientId: "rA", itemId: "i2", lineTotalCents: null },
    ]);
    expect(c.bestByItem["i1"]).toEqual({ cents: 500, recipientId: "rA" });
    expect(c.bestByItem["i2"]).toBeNull();
    expect(c.totalsByRecipient).toEqual({ rA: 500, rB: 0 });
    expect(c.bestTotalRecipientId).toBe("rA"); // rB never quoted, so excluded
  });

  it("is empty-safe", () => {
    const c = compareLineQuotes([], [], []);
    expect(c.bestTotalRecipientId).toBeNull();
    expect(c.bestByItem).toEqual({});
  });
});
