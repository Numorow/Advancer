import { describe, it, expect } from "vitest";
import {
  matchBudgetCategory,
  normalizeCategoryName,
  nextSort,
} from "../budget-sync";

describe("normalizeCategoryName", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeCategoryName("  Site   Furniture ")).toBe("site furniture");
    expect(normalizeCategoryName("Toilets")).toBe("toilets");
  });
});

describe("matchBudgetCategory", () => {
  const cats = [
    { id: "a", name: "Toilets" },
    { id: "b", name: "Fencing" },
    { id: "c", name: "Power / Electricians" },
  ];

  it("matches an existing category case-insensitively", () => {
    expect(matchBudgetCategory(cats, "toilets")).toBe("a");
    expect(matchBudgetCategory(cats, "FENCING")).toBe("b");
  });

  it("returns null when no category mirrors the section (caller creates it)", () => {
    // "Portables (Buildings)" does not equal the seeded "Portables" — a new
    // category is created so the budget mirrors the checklist section verbatim.
    expect(matchBudgetCategory(cats, "Portables (Buildings)")).toBeNull();
    expect(matchBudgetCategory(cats, "Operations & Logistics")).toBeNull();
  });

  it("handles an empty category list", () => {
    expect(matchBudgetCategory([], "Toilets")).toBeNull();
  });
});

describe("nextSort", () => {
  it("starts at 0 for an empty group", () => {
    expect(nextSort([])).toBe(0);
  });

  it("lands one past the current max, ignoring null sorts", () => {
    expect(nextSort([{ sort: 0 }, { sort: 3 }, { sort: 1 }])).toBe(4);
    expect(nextSort([{ sort: null }, { sort: 2 }])).toBe(3);
  });
});
