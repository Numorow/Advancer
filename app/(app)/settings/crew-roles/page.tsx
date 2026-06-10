import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isWriterRole } from "@/lib/org/members";
import { CrewRolesGrid, type CrewRoleRow } from "./crew-roles-grid";

export default async function CrewRolesPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("crew_roles")
    .select("id, name, default_rate_cents, sort")
    .eq("org_id", ctx.orgId)
    .order("sort", { ascending: true });

  const rows: CrewRoleRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    rateCents: r.default_rate_cents,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Crew roles</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Reusable role + default rate templates used when planning crew shifts.
        </p>
      </div>
      <CrewRolesGrid rows={rows} canEdit={isWriterRole(ctx.role)} />
    </div>
  );
}
