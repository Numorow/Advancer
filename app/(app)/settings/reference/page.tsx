import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isWriterRole } from "@/lib/org/members";
import { ReferenceGrid, type RefRow } from "./reference-grid";

export default async function ReferencePage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reference_values")
    .select("id, category, value, label, sort")
    .eq("org_id", ctx.orgId)
    .order("category", { ascending: true })
    .order("sort", { ascending: true });

  const rows: RefRow[] = (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    value: r.value,
    label: r.label,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Reference data</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Org-level lookup lists (people, zones, truck types, schedule types) reused across modules.
        </p>
      </div>
      <ReferenceGrid rows={rows} canEdit={isWriterRole(ctx.role)} />
    </div>
  );
}
