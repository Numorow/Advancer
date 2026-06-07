import { describe, it, expect } from "vitest";
import { BLANK_TEMPLATE } from "../blank-event";

describe("blank event template", () => {
  it("has the 15 standard checklist sections", () => {
    expect(BLANK_TEMPLATE.checklistSections).toHaveLength(15);
    const names = BLANK_TEMPLATE.checklistSections.map((s) => s.name);
    expect(names).toContain("Power");
    expect(names).toContain("Toilets");
    expect(names).toContain("Operations & Logistics");
  });

  it("every section has at least one item and unique names", () => {
    for (const s of BLANK_TEMPLATE.checklistSections) expect(s.items.length).toBeGreaterThan(0);
    const names = BLANK_TEMPLATE.checklistSections.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has the 11 budget categories", () => {
    expect(BLANK_TEMPLATE.budgetCategories).toHaveLength(11);
    expect(BLANK_TEMPLATE.budgetCategories).toContain("Power / Electricians");
  });

  it("seeds General and VIP toilet areas with types and targets", () => {
    expect(BLANK_TEMPLATE.toiletAreas.map((a) => a.area)).toEqual(["General", "VIP"]);
    expect(BLANK_TEMPLATE.toiletAreas[0].ratioTarget).toBe(75);
    expect(BLANK_TEMPLATE.toiletAreas[1].ratioTarget).toBe(45);
    for (const a of BLANK_TEMPLATE.toiletAreas) expect(a.types).toContain("16 Pan Block");
  });
});
