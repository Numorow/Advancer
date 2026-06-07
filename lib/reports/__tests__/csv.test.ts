import { describe, it, expect } from "vitest";
import { toCsv } from "../csv";
import type { ReportData } from "../types";

const report: ReportData = {
  title: "Budget summary",
  columns: [
    { key: "Category", label: "Category" },
    { key: "Quoted", label: "Quoted", align: "right" },
  ],
  rows: [
    { Category: "Power", Quoted: "$7,360.00" },
    { Category: 'Fence, "white"', Quoted: "$250.80" },
    { Category: "Line\nbreak", Quoted: "" },
  ],
  totals: { Category: "TOTAL", Quoted: "$7,610.80" },
};

describe("CSV export", () => {
  it("emits a header, rows and a totals line", () => {
    const csv = toCsv(report);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("Category,Quoted");
    expect(lines[1]).toBe('Power,"$7,360.00"');
    expect(lines).toHaveLength(5); // header + 3 rows + totals
  });

  it("quotes fields containing commas, quotes and newlines", () => {
    const csv = toCsv(report);
    // value with a comma is wrapped: "$7,360.00"
    expect(csv).toContain('"$7,360.00"');
    // value with embedded quotes doubles them
    expect(csv).toContain('"Fence, ""white"""');
    // value with newline is wrapped
    expect(csv).toContain('"Line\nbreak"');
  });

  it("ends with a CRLF and includes the totals row", () => {
    const csv = toCsv(report);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).toContain("TOTAL,");
  });
});
