import { describe, it, expect } from "vitest";
import {
  expandDays,
  phaseScheduleEntries,
  regenPlan,
  phaseForDate,
  deriveEventDays,
  eventSpan,
  type PhaseInput,
} from "../schedule-phases";

const PHASES: PhaseInput = {
  bumpIn: { from: "2026-08-01", to: "2026-08-02" },
  eventDays: { from: "2026-08-03", to: "2026-08-04" },
  bumpOut: { from: "2026-08-05", to: null },
};

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

describe("regenPlan", () => {
  const desired = phaseScheduleEntries(PHASES); // 5 days: 08-01..08-05
  it("inserts all when no auto rows exist", () => {
    const plan = regenPlan([], desired);
    expect(plan.toDeleteIds).toEqual([]);
    expect(plan.toInsert).toHaveLength(5);
  });
  it("keeps surviving days and only deletes/inserts the delta", () => {
    // existing auto rows for 08-01 (ON_SITE, survives) and 07-30 (gone) and 08-03 wrong type
    const plan = regenPlan(
      [
        { id: "keep", date: "2026-08-01", type: "ON_SITE" },
        { id: "gone", date: "2026-07-30", type: "ON_SITE" },
        { id: "wrongtype", date: "2026-08-03", type: "ON_SITE" },
      ],
      desired,
    );
    expect(plan.toDeleteIds.sort()).toEqual(["gone", "wrongtype"]);
    // 08-01/ON_SITE already present → not re-inserted; the other 4 desired days inserted
    expect(plan.toInsert.map((d) => d.date)).not.toContain("2026-08-01");
    expect(plan.toInsert).toHaveLength(4);
  });
});

describe("phaseForDate", () => {
  it("classifies a date into its phase", () => {
    expect(phaseForDate("2026-08-01", PHASES)).toBe("Bump-in");
    expect(phaseForDate("2026-08-03", PHASES)).toBe("Event Day");
    expect(phaseForDate("2026-08-05", PHASES)).toBe("Bump-out");
    expect(phaseForDate("2026-08-09", PHASES)).toBeNull();
  });
});

describe("deriveEventDays", () => {
  it("labels distinct sorted schedule dates by phase", () => {
    expect(deriveEventDays(["2026-08-03", "2026-08-01", "2026-08-03", null, "2026-08-09"], PHASES)).toEqual([
      { date: "2026-08-01", label: "Bump-in" },
      { date: "2026-08-03", label: "Event Day" },
      { date: "2026-08-09", label: "" },
    ]);
  });
});

describe("eventSpan", () => {
  it("spans earliest start to latest end", () => {
    expect(eventSpan(PHASES)).toEqual({ start: "2026-08-01", end: "2026-08-05" });
  });
  it("is null/null with no ranges", () => {
    expect(eventSpan({ bumpIn: { from: null, to: null }, eventDays: { from: null, to: null }, bumpOut: { from: null, to: null } })).toEqual({ start: null, end: null });
  });
});
