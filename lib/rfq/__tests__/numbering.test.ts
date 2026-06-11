import { describe, it, expect } from "vitest";
import { allocateRfqNumbers } from "../numbering";

const item = (id: string, categoryId: string, rfqNo: string | null = null) => ({ id, categoryId, rfqNo });

describe("allocateRfqNumbers", () => {
  it("allocates sequential zero-padded numbers in category order", () => {
    const out = allocateRfqNumbers({
      items: [item("a", "cat-power"), item("b", "cat-fencing"), item("c", "cat-power")],
      existingNumbers: [],
      categoryOrder: ["cat-power", "cat-fencing"],
    });
    expect(out).toEqual([
      { categoryId: "cat-power", rfqNo: "RFQ-001", itemIds: ["a", "c"] },
      { categoryId: "cat-fencing", rfqNo: "RFQ-002", itemIds: ["b"] },
    ]);
  });

  it("skips categories with no un-numbered items", () => {
    const out = allocateRfqNumbers({
      items: [item("a", "cat-1", "RFQ-001"), item("b", "cat-2")],
      existingNumbers: [],
      categoryOrder: ["cat-1", "cat-2", "cat-3"],
    });
    expect(out).toEqual([{ categoryId: "cat-2", rfqNo: "RFQ-002", itemIds: ["b"] }]);
  });

  it("numbers only the remainder of a partially-numbered category", () => {
    const out = allocateRfqNumbers({
      items: [item("a", "cat-1", "RFQ-004"), item("b", "cat-1"), item("c", "cat-1")],
      existingNumbers: [],
      categoryOrder: ["cat-1"],
    });
    expect(out).toEqual([{ categoryId: "cat-1", rfqNo: "RFQ-005", itemIds: ["b", "c"] }]);
  });

  it("seeds past existing canonical numbers from rfqs and budget lines", () => {
    const out = allocateRfqNumbers({
      items: [item("a", "cat-1")],
      existingNumbers: ["RFQ-007", "rfq-002"],
      categoryOrder: ["cat-1"],
    });
    expect(out[0].rfqNo).toBe("RFQ-008");
  });

  it("treats non-conforming manual values as taken without poisoning the seed", () => {
    const out = allocateRfqNumbers({
      items: [item("a", "cat-1", "PWR-9"), item("b", "cat-1"), item("c", "cat-2")],
      existingNumbers: ["12", "fencing quote"],
      categoryOrder: ["cat-1", "cat-2"],
    });
    expect(out.map((a) => a.rfqNo)).toEqual(["RFQ-001", "RFQ-002"]);
  });

  it("skips candidates that collide with manual numbers (case-insensitive)", () => {
    const out = allocateRfqNumbers({
      items: [item("a", "cat-1"), item("b", "cat-2")],
      existingNumbers: ["rfq-001", " RFQ-002 "],
      categoryOrder: ["cat-1", "cat-2"],
    });
    expect(out.map((a) => a.rfqNo)).toEqual(["RFQ-003", "RFQ-004"]);
  });

  it("grows past the pad width naturally", () => {
    const out = allocateRfqNumbers({
      items: [item("a", "cat-1")],
      existingNumbers: ["RFQ-999"],
      categoryOrder: ["cat-1"],
    });
    expect(out[0].rfqNo).toBe("RFQ-1000");
  });

  it("treats whitespace-only rfqNo as un-numbered", () => {
    const out = allocateRfqNumbers({
      items: [item("a", "cat-1", "  ")],
      existingNumbers: [],
      categoryOrder: ["cat-1"],
    });
    expect(out).toEqual([{ categoryId: "cat-1", rfqNo: "RFQ-001", itemIds: ["a"] }]);
  });

  it("returns [] when there is nothing to number", () => {
    expect(allocateRfqNumbers({ items: [], existingNumbers: [], categoryOrder: [] })).toEqual([]);
    expect(
      allocateRfqNumbers({
        items: [item("a", "cat-1", "RFQ-001")],
        existingNumbers: [],
        categoryOrder: ["cat-1"],
      }),
    ).toEqual([]);
  });
});
