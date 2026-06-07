import { describe, it, expect } from "vitest";
import { toXlsx } from "../xlsx";
import { toPdf } from "../pdf";
import type { ReportData } from "../types";

const report: ReportData = {
  title: "Budget summary",
  subtitle: "Calcio Italiano 2026",
  columns: [
    { key: "Category", label: "Category" },
    { key: "Quoted", label: "Quoted ex-GST", align: "right" },
  ],
  rows: [
    { Category: "Power / Electricians", Quoted: "$7,360.00" },
    { Category: "Toilets", Quoted: "$10,906.00" },
  ],
  totals: { Category: "TOTAL", Quoted: "$18,266.00" },
};

describe("XLSX export renders a real workbook", () => {
  it("returns a buffer with the XLSX (zip) signature", async () => {
    const buf = await toXlsx(report);
    expect(buf.length).toBeGreaterThan(1000);
    // .xlsx is a zip — starts with "PK"
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

describe("PDF export renders a real PDF", () => {
  it("returns a buffer with the %PDF header", async () => {
    const buf = await toPdf(report, "Calcio Italiano 2026");
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
