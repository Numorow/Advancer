import { describe, it, expect } from "vitest";
import { BLANK_TEMPLATE } from "../blank-event";
import { DEFAULT_TEMPLATE_KEY, TEMPLATES, buildTemplate, getTemplate } from "../catalog";

const GREENFIELD_KEYS = ["greenfield-0-5k", "greenfield-5-10k", "greenfield-10-20k", "greenfield-20k-plus"];

describe("template catalogue", () => {
  it("ships 8 templates with unique keys, blank first", () => {
    expect(TEMPLATES).toHaveLength(8);
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(8);
    expect(TEMPLATES[0].key).toBe(DEFAULT_TEMPLATE_KEY);
    expect(getTemplate("nope")).toBeUndefined();
  });

  it("blank template content matches BLANK_TEMPLATE exactly", () => {
    const blank = getTemplate(DEFAULT_TEMPLATE_KEY)!;
    expect(blank.checklistSections).toEqual(BLANK_TEMPLATE.checklistSections);
    expect(blank.budgetCategories).toEqual(BLANK_TEMPLATE.budgetCategories);
    expect(blank.toiletAreas).toEqual(BLANK_TEMPLATE.toiletAreas);
  });

  it.each(TEMPLATES.map((t) => [t.key, t] as const))("%s is structurally sound", (_key, tpl) => {
    // Management first — its items mirror 1:1 into the Management module.
    expect(tpl.checklistSections[0].name).toBe("Management");
    // Unique non-empty sections, unique items within each.
    const names = tpl.checklistSections.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of tpl.checklistSections) {
      expect(s.items.length).toBeGreaterThan(0);
      expect(new Set(s.items.map((i) => i.toLowerCase())).size).toBe(s.items.length);
    }
    // Unique non-empty budget categories.
    expect(tpl.budgetCategories.length).toBeGreaterThan(0);
    expect(new Set(tpl.budgetCategories).size).toBe(tpl.budgetCategories.length);
    // Toilet areas constrained to the register's select options.
    for (const a of tpl.toiletAreas) expect(["General", "VIP"]).toContain(a.area);
    expect(tpl.description.length).toBeGreaterThan(0);
  });

  it("venue templates seed no toilet calculator rows (house facilities)", () => {
    for (const key of ["venue-club", "venue-arena", "venue-stadium"]) {
      expect(getTemplate(key)!.toiletAreas).toEqual([]);
    }
  });

  it("greenfield tiers are cumulative — every smaller-tier item survives into the larger", () => {
    for (let i = 1; i < GREENFIELD_KEYS.length; i++) {
      const smaller = getTemplate(GREENFIELD_KEYS[i - 1])!;
      const larger = getTemplate(GREENFIELD_KEYS[i])!;
      for (const s of smaller.checklistSections) {
        const match = larger.checklistSections.find((ls) => ls.name === s.name);
        expect(match, `${larger.key} lost section "${s.name}"`).toBeDefined();
        for (const item of s.items) expect(match!.items).toContain(item);
      }
      for (const c of smaller.budgetCategories) expect(larger.budgetCategories).toContain(c);
    }
  });

  it("templates share no mutable state with each other or the blank skeleton", () => {
    const blank = getTemplate(DEFAULT_TEMPLATE_KEY)!;
    expect(blank.checklistSections).not.toBe(BLANK_TEMPLATE.checklistSections);
    expect(blank.checklistSections[0].items).not.toBe(BLANK_TEMPLATE.checklistSections[0].items);
    const t5 = getTemplate("greenfield-0-5k")!;
    const t10 = getTemplate("greenfield-5-10k")!;
    expect(t5.checklistSections[0].items).not.toBe(t10.checklistSections[0].items);
  });
});

describe("buildTemplate guards", () => {
  const spec = { key: "t", label: "T", group: "Blank" as const, description: "d" };

  it("throws on unknown section names (typo guard)", () => {
    expect(() => buildTemplate({ ...spec, removeSections: ["Nope"] })).toThrow(/unknown section/);
    expect(() => buildTemplate({ ...spec, addItems: { Nope: ["x"] } })).toThrow(/unknown section/);
    expect(() => buildTemplate({ ...spec, replaceItems: { Nope: ["x"] } })).toThrow(/unknown section/);
  });

  it("throws on duplicate additions", () => {
    expect(() => buildTemplate({ ...spec, addItems: { Power: ["60kva"] } })).toThrow(/already exists/);
    expect(() => buildTemplate({ ...spec, addSections: [{ name: "Power", items: ["x"] }] })).toThrow(
      /already exists/,
    );
    expect(() => buildTemplate({ ...spec, extraBudgetCategories: ["Toilets"] })).toThrow(/already exists/);
  });

  it("throws on unknown budget category removal and empty replacements", () => {
    expect(() => buildTemplate({ ...spec, removeBudgetCategories: ["Nope"] })).toThrow(/unknown category/);
    expect(() => buildTemplate({ ...spec, replaceItems: { Power: [] } })).toThrow(/at least one item/);
    expect(() => buildTemplate({ ...spec, addSections: [{ name: "New", items: [] }] })).toThrow(
      /at least one item/,
    );
  });

  it("inserts new sections before Security", () => {
    const t = buildTemplate({ ...spec, addSections: [{ name: "Water & Plumbing", items: ["Plumber"] }] });
    const names = t.checklistSections.map((s) => s.name);
    expect(names.indexOf("Water & Plumbing")).toBe(names.indexOf("Security") - 1);
  });
});
