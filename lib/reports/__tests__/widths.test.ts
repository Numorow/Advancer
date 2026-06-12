import { describe, it, expect } from "vitest";
import { columnWidths } from "../widths";
import type { ReportData } from "../types";

const pct = (s: string) => parseFloat(s);

describe("columnWidths", () => {
  it("gives content-heavy columns more width than short ones", () => {
    const r: ReportData = {
      title: "t",
      columns: [
        { key: "id", label: "#" },
        { key: "email", label: "Email" },
      ],
      rows: [{ id: "1", email: "accounts.payable@melbourneeventinfrastructure.com.au" }],
    };
    const w = columnWidths(r).map(pct);
    expect(w[1]).toBeGreaterThan(w[0]);
  });

  it("normalises to ~100%", () => {
    const r: ReportData = {
      title: "t",
      columns: [
        { key: "a", label: "A" },
        { key: "b", label: "BBBB" },
        { key: "c", label: "Cc" },
      ],
      rows: [{ a: "x", b: "yy", c: "zzz" }],
    };
    const sum = columnWidths(r).map(pct).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(99.5);
    expect(sum).toBeLessThan(100.5);
  });

  it("clamps one huge cell so it can't starve the other columns", () => {
    const r: ReportData = {
      title: "t",
      columns: [
        { key: "a", label: "A" },
        { key: "big", label: "Big" },
      ],
      rows: [{ a: "short", big: "x".repeat(500) }],
    };
    const w = columnWidths(r).map(pct);
    expect(w[1]).toBeLessThan(90); // capped at MAX weight, not ~99%
    expect(w[0]).toBeGreaterThan(10);
  });

  it("a single column takes the full width", () => {
    const r: ReportData = { title: "t", columns: [{ key: "n", label: "Name" }], rows: [{ n: "value" }] };
    expect(columnWidths(r)).toEqual(["100.00%"]);
  });
});
