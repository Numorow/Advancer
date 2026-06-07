import { describe, it, expect } from "vitest";
import { expandDays, phaseScheduleEntries } from "../schedule-phases";

describe("expandDays", () => {
  it("returns a single day when `to` is empty or equal", () => {
    expect(expandDays("2026-08-01", null)).toEqual(["2026-08-01"]);
    expect(expandDays("2026-08-01", "2026-08-01")).toEqual(["2026-08-01"]);
  });
  it("expands an inclusive range", () => {
    expect(expandDays("2026-08-01", "2026-08-03")).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });
  it("handles month boundaries", () => {
    expect(expandDays("2026-07-31", "2026-08-02")).toEqual(["2026-07-31", "2026-08-01", "2026-08-02"]);
  });
  it("ignores a `to` before `from` (treats as single day) and empty input", () => {
    expect(expandDays("2026-08-05", "2026-08-01")).toEqual(["2026-08-05"]);
    expect(expandDays(null, "2026-08-01")).toEqual([]);
  });
});

describe("phaseScheduleEntries", () => {
  it("creates one tagged entry per phase day, sorted by date", () => {
    const entries = phaseScheduleEntries({
      bumpIn: { from: "2026-08-01", to: "2026-08-03" },
      eventDays: { from: "2026-08-04", to: "2026-08-05" },
      bumpOut: { from: "2026-08-06", to: null },
    });
    expect(entries).toHaveLength(6);
    expect(entries.map((e) => e.date)).toEqual([
      "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
    ]);
    expect(entries[0]).toEqual({ date: "2026-08-01", type: "ON_SITE", action: "Bump-in — Day 1" });
    expect(entries[3]).toEqual({ date: "2026-08-04", type: "SHOW_TIME", action: "Event Day — Day 1" });
    expect(entries[5]).toEqual({ date: "2026-08-06", type: "BUMP_OUT", action: "Bump-out" });
  });

  it("returns nothing when no phases are set", () => {
    expect(phaseScheduleEntries({ bumpIn: { from: null, to: null }, eventDays: { from: null, to: null }, bumpOut: { from: null, to: null } })).toEqual([]);
  });
});
