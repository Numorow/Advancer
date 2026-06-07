import { describe, it, expect } from "vitest";
import { effectiveHours, shiftCostCents, rollupCrew, rollupCrewBy } from "../crew";

describe("crew labour costing", () => {
  it("prefers actual hours, falls back to scheduled, then 0", () => {
    expect(effectiveHours({ actualHours: 7.5, scheduledHours: 5, rateCents: 0 })).toBe(7.5);
    expect(effectiveHours({ actualHours: null, scheduledHours: 5, rateCents: 0 })).toBe(5);
    expect(effectiveHours({ actualHours: null, scheduledHours: null, rateCents: 0 })).toBe(0);
  });

  it("computes shift cost as hours × rate (matching the workbook)", () => {
    // Site Manager Sat: 7.5h × $125 = $937.50
    expect(shiftCostCents({ actualHours: 7.5, scheduledHours: 5, rateCents: 12500 })).toBe(93750);
    // Site Crew: 7.5h × $69 = $517.50
    expect(shiftCostCents({ actualHours: 7.5, scheduledHours: 5, rateCents: 6900 })).toBe(51750);
    // weekday: 11.5h × $100 = $1150.00
    expect(shiftCostCents({ actualHours: 11.5, scheduledHours: 11.5, rateCents: 10000 })).toBe(115000);
  });

  it("falls back to 0 cost when the rate is missing (the #N/A guard)", () => {
    expect(shiftCostCents({ actualHours: 7.5, scheduledHours: 7.5, rateCents: null })).toBe(0);
    expect(shiftCostCents({ actualHours: 7.5, scheduledHours: 7.5, rateCents: Infinity })).toBe(0);
  });

  it("rolls up hours and labour with GST", () => {
    const r = rollupCrew([
      { actualHours: 7.5, scheduledHours: 5, rateCents: 12500 }, // 937.50
      { actualHours: 7.5, scheduledHours: 5, rateCents: 6900 }, // 517.50
      { actualHours: 7.5, scheduledHours: 5, rateCents: null }, // 0 (no rate)
    ]);
    expect(r.shifts).toBe(3);
    expect(r.actualHours).toBe(22.5);
    expect(r.scheduledHours).toBe(15);
    expect(r.exGstCents).toBe(145500); // 937.50 + 517.50
    expect(r.gstCents).toBe(14550);
    expect(r.incGstCents).toBe(160050);
  });

  it("groups by day and by role", () => {
    const shifts = [
      { actualHours: 8, scheduledHours: 8, rateCents: 10000, day: "2026-08-01", role: "SM" },
      { actualHours: 8, scheduledHours: 8, rateCents: 5000, day: "2026-08-01", role: "Crew" },
      { actualHours: 10, scheduledHours: 10, rateCents: 10000, day: "2026-08-02", role: "SM" },
    ];
    const byDay = rollupCrewBy(shifts, (s) => s.day);
    expect(byDay).toHaveLength(2);
    expect(byDay.find((g) => g.key === "2026-08-01")!.rollup.exGstCents).toBe(120000);
    const byRole = rollupCrewBy(shifts, (s) => s.role);
    expect(byRole.find((g) => g.key === "SM")!.rollup.exGstCents).toBe(180000);
  });
});
