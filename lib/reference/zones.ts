import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/** Reference data zones feed the location inputs (schedule + infra registers). */

export interface ZoneRow {
  value: string;
  label: string | null;
}

/** Display strings for zone suggestions — label wins over value; trimmed, deduped, blanks dropped. */
export function toZoneOptions(rows: ZoneRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const display = (row.label ?? row.value ?? "").trim();
    if (!display) continue;
    const key = display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}

/** Org's zones from reference data (RLS scopes to the caller's org). */
export async function fetchZoneOptions(supabase: SupabaseClient<Database>): Promise<string[]> {
  const { data } = await supabase
    .from("reference_values")
    .select("value, label")
    .eq("category", "zone")
    .order("sort", { ascending: true })
    .order("value", { ascending: true });
  return toZoneOptions(data ?? []);
}
