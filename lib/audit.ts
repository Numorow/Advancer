import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type DB = SupabaseClient<Database>;
type Json = Database["public"]["Tables"]["audit_log"]["Insert"]["after"];

/** Append an immutable audit entry. Called from every mutating server action. */
export async function writeAudit(
  supabase: DB,
  entry: {
    orgId: string;
    eventId?: string | null;
    actor: string;
    entity: string;
    entityId?: string | null;
    action: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await supabase.from("audit_log").insert({
    org_id: entry.orgId,
    event_id: entry.eventId ?? null,
    actor: entry.actor,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    before: (entry.before ?? null) as Json,
    after: (entry.after ?? null) as Json,
  });
}
