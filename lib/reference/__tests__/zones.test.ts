import { describe, it, expect } from "vitest";
import { toZoneOptions } from "../zones";

describe("toZoneOptions", () => {
  it("prefers label over value", () => {
    expect(toZoneOptions([{ value: "zone-a", label: "Main Arena" }])).toEqual(["Main Arena"]);
  });

  it("falls back to value when label is missing", () => {
    expect(toZoneOptions([{ value: "BOH", label: null }])).toEqual(["BOH"]);
  });

  it("trims and drops blanks", () => {
    expect(
      toZoneOptions([
        { value: "  FOH  ", label: null },
        { value: "x", label: "   " },
        { value: "", label: null },
      ]),
    ).toEqual(["FOH"]);
  });

  it("dedupes case-insensitively, keeping first occurrence", () => {
    expect(
      toZoneOptions([
        { value: "Gate 1", label: null },
        { value: "gate 1", label: null },
        { value: "g2", label: "Gate 2" },
      ]),
    ).toEqual(["Gate 1", "Gate 2"]);
  });

  it("returns [] for empty input", () => {
    expect(toZoneOptions([])).toEqual([]);
  });
});
