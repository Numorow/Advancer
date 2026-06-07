import type { ReportData } from "./types";

function esc(v: string | number | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(report: ReportData): string {
  const lines: string[] = [];
  lines.push(report.columns.map((c) => esc(c.label)).join(","));
  for (const row of report.rows) {
    lines.push(report.columns.map((c) => esc(row[c.key])).join(","));
  }
  if (report.totals) {
    lines.push(report.columns.map((c) => esc(report.totals![c.key])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
