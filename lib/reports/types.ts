import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export type DB = SupabaseClient<Database>;

export interface ReportColumn {
  key: string;
  label: string;
  align?: "right" | "center";
}

export interface ReportData {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  /** Optional totals row rendered emphasised at the bottom. */
  totals?: Record<string, string | number> | null;
}

export interface ReportDef {
  key: string;
  title: string;
  description: string;
  build: (supabase: DB, eventId: string) => Promise<ReportData>;
}

export type ExportFormat = "csv" | "xlsx" | "pdf";
