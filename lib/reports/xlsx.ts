import ExcelJS from "exceljs";
import type { ReportData } from "./types";

export async function toXlsx(report: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Advancer — A Kyron System";
  const ws = wb.addWorksheet(report.title.slice(0, 31) || "Report");

  ws.addRow([report.title]).font = { bold: true, size: 14 };
  if (report.subtitle) ws.addRow([report.subtitle]).font = { italic: true, color: { argb: "FF666666" } };
  ws.addRow([]);

  const header = ws.addRow(report.columns.map((c) => c.label));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  });

  for (const row of report.rows) {
    ws.addRow(report.columns.map((c) => row[c.key] ?? ""));
  }
  if (report.totals) {
    ws.addRow(report.columns.map((c) => report.totals![c.key] ?? "")).font = { bold: true };
  }

  report.columns.forEach((c, i) => {
    const maxRow = report.rows.reduce((m, r) => Math.max(m, String(r[c.key] ?? "").length), c.label.length);
    ws.getColumn(i + 1).width = Math.min(48, Math.max(10, maxRow + 2));
    if (c.align === "right") ws.getColumn(i + 1).alignment = { horizontal: "right" };
    else if (c.align === "center") ws.getColumn(i + 1).alignment = { horizontal: "center" };
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
