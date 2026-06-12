import type { ReportData } from "./types";

const MIN_WEIGHT = 6;
const MAX_WEIGHT = 40;

/**
 * Percentage column widths for a report table, weighted by actual content
 * (the longest of the label or any cell value in that column), clamped to
 * [6, 40] so one very long cell can't starve the rest. Normalised to ~100%,
 * so the table always fills — and fits — the page width. Replaces the old
 * label-length-only sizing that squeezed content-heavy columns.
 */
export function columnWidths(report: ReportData): string[] {
  const weights = report.columns.map((c) => {
    let longest = c.label.length;
    for (const row of report.rows) {
      const len = String(row[c.key] ?? "").length;
      if (len > longest) longest = len;
    }
    return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, longest));
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => `${((w / total) * 100).toFixed(2)}%`);
}
