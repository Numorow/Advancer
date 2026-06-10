import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/org/members";
import { MembersList, type MemberRow } from "./members-list";

export default async function MembersPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("organisation_members")
    .select("id, user_id, role, created_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: true });

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] };
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rows: MemberRow[] = (members ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role,
    email: pmap.get(m.user_id)?.email ?? null,
    fullName: pmap.get(m.user_id)?.full_name ?? null,
    isYou: m.user_id === ctx.userId,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          People with access to {ctx.orgName}. Owners and admins can change roles.
        </p>
      </div>
      <MembersList rows={rows} canManage={isAdminRole(ctx.role)} />
    </div>
  );
}
