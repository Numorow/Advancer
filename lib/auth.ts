import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SessionContext {
  userId: string;
  email: string | null;
  orgId: string;
  orgName: string;
  role: string;
}

/**
 * Resolve the current user and their organisation. The first authenticated
 * user claims ownership of the seeded Kyron org (idempotent RPC); thereafter
 * membership is read back. Cached per-request.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // First-user bootstrap — no-op once the org has members.
  await supabase.rpc("claim_kyron_owner");

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("org_id, role, organisations(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      userId: user.id,
      email: user.email ?? null,
      orgId: "",
      orgName: "",
      role: "none",
    };
  }

  const org = membership.organisations as unknown as { name: string } | null;
  return {
    userId: user.id,
    email: user.email ?? null,
    orgId: membership.org_id,
    orgName: org?.name ?? "Kyron",
    role: membership.role,
  };
});

export async function requireContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}
