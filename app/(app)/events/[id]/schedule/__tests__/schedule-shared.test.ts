import { describe, it, expect } from "vitest";
import { SCHEDULE_TYPES } from "@/lib/import/types";
import { TYPE_LABELS, TYPE_COLORS, TYPE_CHIP_CLASSES } from "../schedule-shared";

// Adding a schedule type to the enum without its display metadata leaves
// blank labels / uncoloured bars+chips — fail here instead of in the UI.
describe("schedule type metadata coverage", () => {
  it.each(SCHEDULE_TYPES)("%s has a label, timeline colour and chip classes", (t) => {
    expect(TYPE_LABELS[t]).toBeTruthy();
    expect(TYPE_COLORS[t]).toMatch(/^bg-/);
    expect(TYPE_CHIP_CLASSES[t]).toMatch(/bg-.*text-.*dark:bg-.*dark:text-/);
  });

  it("has no orphan metadata for unknown types", () => {
    const known = new Set<string>(SCHEDULE_TYPES);
    for (const key of [...Object.keys(TYPE_LABELS), ...Object.keys(TYPE_COLORS), ...Object.keys(TYPE_CHIP_CLASSES)]) {
      expect(known.has(key), `unexpected type metadata: ${key}`).toBe(true);
    }
  });
});
