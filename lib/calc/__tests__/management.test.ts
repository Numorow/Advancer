import { describe, it, expect } from "vitest";
import { taskCostCents, rollupManagement, rollupManagementBy } from "../management";

describe("management labour costing", () => {
  it("computes task cost as hours × rate", () => {
    expect(taskCostCents(3, 11500)).toBe(34500);
    expect(taskCostCents(10, 11500)).toBe(115000);
  });
  it("guards missing hours/rate to 0", () => {
    expect(taskCostCents(3, null)).toBe(0);
    expect(taskCostCents(null, 11500)).toBe(0);
  });

  it("rolls up the workbook's WEEK 1 (29 hrs × $115 = $3,335) with completion", () => {
    const week1 = [
      { hours: 3, rateCents: 11500, completed: false },
      { hours: 10, rateCents: 11500, completed: true },
      { hours: 3, rateCents: 11500, completed: false },
      { hours: 3, rateCents: 11500, completed: false },
      { hours: 3, rateCents: 11500, completed: false },
      { hours: 4, rateCents: 11500, completed: false },
      { hours: 3, rateCents: 11500, completed: false },
    ];
    const r = rollupManagement(week1);
    expect(r.tasks).toBe(7);
    expect(r.hours).toBe(29);
    expect(r.exGstCents).toBe(333500); // $3,335.00
    expect(r.gstCents).toBe(33350);
    expect(r.incGstCents).toBe(366850);
    expect(r.completedTasks).toBe(1);
    expect(r.pct).toBe(14);
  });

  it("groups by week", () => {
    const tasks = [
      { hours: 5, rateCents: 10000, completed: true, week: "w1" },
      { hours: 5, rateCents: 10000, completed: false, week: "w1" },
      { hours: 2, rateCents: 10000, completed: false, week: "w2" },
    ];
    const byWeek = rollupManagementBy(tasks, (t) => t.week);
    expect(byWeek).toHaveLength(2);
    expect(byWeek.find((g) => g.key === "w1")!.rollup.exGstCents).toBe(100000);
    expect(byWeek.find((g) => g.key === "w1")!.rollup.pct).toBe(50);
  });
});
