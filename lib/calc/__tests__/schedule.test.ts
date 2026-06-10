import { describe, it, expect } from "vitest";
import { hhmmToMinutes, dayRange, barGeometry, hourTicks, minutesToLabel } from "../schedule";

describe("hhmmToMinutes", () => {
  it("parses HH:MM", () => {
    expect(hhmmToMinutes("08:30")).toBe(510);
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("23:59")).toBe(1439);
  });
  it("rejects junk and null", () => {
    expect(hhmmToMinutes(null)).toBeNull();
    expect(hhmmToMinutes("")).toBeNull();
    expect(hhmmToMinutes("9am")).toBeNull();
    expect(hhmmToMinutes("24:00")).toBeNull();
    expect(hhmmToMinutes("08:60")).toBeNull();
  });
});

describe("dayRange", () => {
  it("spans min start to max finish padded to whole hours", () => {
    expect(dayRange([{ startTime: "08:30", finishTime: "10:15" }, { startTime: "12:00", finishTime: null }])).toEqual({
      startMin: 8 * 60, // 08:00 (floored from 08:30)
      endMin: 12 * 60, // 12:00 (max time = the second entry's start, already whole-hour)
    });
  });
  it("falls back to a default window with no times", () => {
    expect(dayRange([{ startTime: null, finishTime: null }])).toEqual({ startMin: 6 * 60, endMin: 22 * 60 });
    expect(dayRange([])).toEqual({ startMin: 6 * 60, endMin: 22 * 60 });
  });
  it("guarantees at least a one-hour window", () => {
    const r = dayRange([{ startTime: "09:00", finishTime: "09:00" }]);
    expect(r.endMin).toBeGreaterThan(r.startMin);
  });
});

describe("barGeometry", () => {
  const range = { startMin: 8 * 60, endMin: 12 * 60 }; // 4h span = 240min

  it("positions a bar by start/finish", () => {
    const g = barGeometry(9 * 60, 10 * 60, range)!; // 09:00-10:00
    expect(g.leftPct).toBeCloseTo(25); // 1h into a 4h span
    expect(g.widthPct).toBeCloseTo(25); // 1h wide
  });
  it("gives a zero-length entry a minimum visible width", () => {
    const g = barGeometry(9 * 60, null, range)!;
    expect(g.widthPct).toBeGreaterThanOrEqual(1.5);
  });
  it("clamps within the axis and never overflows", () => {
    const g = barGeometry(11 * 60, 14 * 60, range)!; // finish past the end
    expect(g.leftPct + g.widthPct).toBeLessThanOrEqual(100.0001);
  });
  it("is null without a start time", () => {
    expect(barGeometry(null, 10 * 60, range)).toBeNull();
  });
});

describe("hourTicks + label", () => {
  it("emits whole-hour ticks across the range", () => {
    expect(hourTicks({ startMin: 8 * 60, endMin: 10 * 60 })).toEqual([480, 540, 600]);
    expect(minutesToLabel(540)).toBe("09:00");
  });
});
