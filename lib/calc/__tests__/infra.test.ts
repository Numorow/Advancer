import { describe, it, expect } from "vitest";
import {
  fencingTotalM,
  toiletAreaSummary,
  fencingGrandTotalM,
  powerSummary,
  structuresSummary,
  furnitureSummary,
  transportSummary,
  productionSummary,
  infraReadiness,
} from "../infra";

describe("fencing total metres", () => {
  it("adds length + mitigation (matching the workbook)", () => {
    expect(fencingTotalM(55, 5.5)).toBe(60.5);
    expect(fencingTotalM(70, 7)).toBe(77);
    expect(fencingTotalM(3, 0.30000000000000004)).toBe(3.3);
  });
  it("treats missing values as 0", () => {
    expect(fencingTotalM(null, null)).toBe(0);
    expect(fencingTotalM(70, null)).toBe(70);
  });
});

describe("toilet ratio summary", () => {
  it("sums pans and computes people-per-pan (the workbook's 71.43)", () => {
    const s = toiletAreaSummary(
      [
        { quantity: 40, pans: 40 },
        { quantity: 2, pans: 2 },
      ],
      3000,
      75,
    );
    expect(s.totalPans).toBe(42);
    expect(s.totalQuantity).toBe(42);
    expect(s.ratio).toBeCloseTo(71.4285, 3);
    expect(s.meetsTarget).toBe(true);
  });

  it("flags when the ratio exceeds the target", () => {
    const s = toiletAreaSummary([{ quantity: 10, pans: 10 }], 1000, 75);
    expect(s.ratio).toBe(100);
    expect(s.meetsTarget).toBe(false);
  });

  it("guards #DIV/0! — no pans yields a null ratio, not Infinity", () => {
    const s = toiletAreaSummary([{ quantity: 0, pans: 0 }], 3000, 45);
    expect(s.totalPans).toBe(0);
    expect(s.ratio).toBeNull();
    expect(s.meetsTarget).toBeNull();
  });

  it("returns null ratio when capacity is unset", () => {
    const s = toiletAreaSummary([{ quantity: 5, pans: 5 }], null, 75);
    expect(s.ratio).toBeNull();
  });
});

describe("per-register summaries", () => {
  it("fencingGrandTotalM sums length + mitigation across rows", () => {
    expect(fencingGrandTotalM([{ length_m: 55, mitigation_m: 5.5 }, { length_m: 70, mitigation_m: 7 }])).toBe(137.5);
    expect(fencingGrandTotalM([])).toBe(0);
  });
  it("powerSummary counts items, qty and supplier coverage", () => {
    expect(powerSummary([{ quantity: 2, supplier_id: "s1" }, { quantity: 3, supplier_id: null }])).toEqual({
      items: 2,
      totalQty: 5,
      withSupplier: 1,
    });
  });
  it("structuresSummary totals footprint area + readiness counts", () => {
    const s = structuresSummary([
      { length_m: 10, width_m: 5, docs_received: true, engineer_signoff: true, supplier_id: "s1" },
      { length_m: 6, width_m: 3, docs_received: false, engineer_signoff: false, supplier_id: null },
    ]);
    expect(s).toEqual({ count: 2, totalAreaM2: 68, docs: 1, signoff: 1, withSupplier: 1 });
  });
  it("furnitureSummary totals qty + allocates by supplier", () => {
    const s = furnitureSummary([
      { asset: "Chair", quantity: 10, supplier_id: "s1" },
      { asset: "Table", quantity: 4, supplier_id: "s1" },
      { asset: "Couch", quantity: 2, supplier_id: null },
    ]);
    expect(s.totalQty).toBe(16);
    expect(s.assets).toBe(3);
    expect(s.bySupplier).toEqual({ s1: 14, __none__: 2 });
  });
  it("transportSummary counts directions + truck types", () => {
    const s = transportSummary([
      { direction: "incoming", truck_type: "Semi" },
      { direction: "outgoing", truck_type: "Semi" },
      { direction: "incoming", truck_type: "Ute" },
    ]);
    expect(s).toEqual({ total: 3, incoming: 2, outgoing: 1, byTruck: { Semi: 2, Ute: 1 } });
  });
  it("productionSummary counts + spans dates", () => {
    expect(productionSummary([{ item_date: "2026-08-08" }, { item_date: "2026-08-06" }, { item_date: null }])).toEqual({
      count: 3,
      firstDate: "2026-08-06",
      lastDate: "2026-08-08",
    });
  });
});

describe("infraReadiness", () => {
  it("averages the available signals", () => {
    const r = infraReadiness({
      power: [{ supplier_id: "s1" }, { supplier_id: null }], // 2 rows, 1 with supplier
      structures: [{ supplier_id: "s1", engineer_signoff: true }], // signoff 1/1
      fencing: [{ supplier_id: "s1" }],
      furniture: [{ supplier_id: "s1" }],
      // supplier coverage = 4/5 = 80
      toilets: [{ area: "General", quantity: 40, pans: 40, capacity: 3000, ratio_target: 75 }], // meets → 100
    });
    // parts: supplier 80, structures signoff 100, toilets met 100 → avg 93
    expect(r.parts.map((p) => p.label)).toEqual(["Supplier coverage", "Structures signed off", "Toilet ratios met"]);
    expect(r.parts[0].pct).toBe(80);
    expect(r.score).toBe(93);
  });
  it("skips parts with no data and is zero when empty", () => {
    const r = infraReadiness({ power: [], structures: [], fencing: [], furniture: [], toilets: [] });
    expect(r.parts).toEqual([]);
    expect(r.score).toBe(0);
  });
});
