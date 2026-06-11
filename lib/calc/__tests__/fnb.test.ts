import { describe, it, expect } from "vitest";
import { fnbRollup } from "../fnb";

const vendor = (over: Record<string, unknown> = {}) => ({
  licence_status: "approved",
  coi_status: "approved",
  permit_status: "approved",
  site_fee_cents: 0,
  bond_cents: 0,
  ...over,
});

describe("fnbRollup", () => {
  it("returns zeros for empty input", () => {
    expect(fnbRollup([], [])).toEqual({
      vendorCount: 0,
      siteFeesCents: 0,
      bondsCents: 0,
      complianceOutstanding: 0,
      cateringHeadcount: 0,
      cateringCostCents: 0,
    });
  });

  it("sums site fees and bonds across vendors", () => {
    const r = fnbRollup(
      [vendor({ site_fee_cents: 50000, bond_cents: 100000 }), vendor({ site_fee_cents: 25000, bond_cents: null })],
      [],
    );
    expect(r.vendorCount).toBe(2);
    expect(r.siteFeesCents).toBe(75000);
    expect(r.bondsCents).toBe(100000);
  });

  it("counts a vendor as outstanding when any compliance doc isn't approved", () => {
    const r = fnbRollup(
      [
        vendor(), // fully approved
        vendor({ coi_status: "missing" }),
        vendor({ licence_status: "received", permit_status: "missing" }), // one vendor, still counts once
      ],
      [],
    );
    expect(r.complianceOutstanding).toBe(2);
  });

  it("sums catering headcount and cost, treating nulls as zero", () => {
    const r = fnbRollup(
      [],
      [
        { headcount: 30, cost_cents: 45000 },
        { headcount: null, cost_cents: 15000 },
        { headcount: 12, cost_cents: null },
      ],
    );
    expect(r.cateringHeadcount).toBe(42);
    expect(r.cateringCostCents).toBe(60000);
  });

  it("coerces numeric-string cents (Postgres numeric/text) safely", () => {
    const r = fnbRollup([vendor({ site_fee_cents: "12345" })], [{ headcount: "5", cost_cents: "100" }]);
    expect(r.siteFeesCents).toBe(12345);
    expect(r.cateringHeadcount).toBe(5);
    expect(r.cateringCostCents).toBe(100);
  });
});
