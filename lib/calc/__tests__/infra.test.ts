import { describe, it, expect } from "vitest";
import { fencingTotalM, toiletAreaSummary } from "../infra";

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
