import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mfaRedirect, type Aal } from "@/lib/auth/mfa-policy";

export interface SessionContext {
  userId: string;
  email: string | null;
  orgId: string;
  orgName: string;
  role: string;
  /** True when the user has a verified TOTP factor (drives the MFA policy). */
  hasVerifiedTotp: boolean;
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

  const hasVerifiedTotp = (user.factors ?? []).some(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );

  const membershipQuery = () =>
    supabase
      .from("organisation_members")
      .select("org_id, role, organisations(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  let { data: membership } = await membershipQuery();

  // Member-less user only: first-user bootstrap, then redeem any email
  // invites — both idempotent, and skipping them for members saves a round
  // trip on every request.
  if (!membership) {
    await supabase.rpc("claim_kyron_owner");
    await supabase.rpc("accept_pending_invites");
    ({ data: membership } = await membershipQuery());
  }

  if (!membership) {
    return {
      userId: user.id,
      email: user.email ?? null,
      orgId: "",
      orgName: "",
      role: "none",
      hasVerifiedTotp,
    };
  }

  const org = membership.organisations as unknown as { name: string } | null;
  return {
    userId: user.id,
    email: user.email ?? null,
    orgId: membership.org_id,
    orgName: org?.name ?? "Kyron",
    role: membership.role,
    hasVerifiedTotp,
  };
});

export async function requireContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  // MFA policy (M20): owners/admins must enrol TOTP; enrolled users must
  // complete the challenge each session. getAuthenticatorAssuranceLevel is a
  // local session decode — no network round trip.
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const path = (await headers()).get("x-pathname") ?? "/";
  const dest = mfaRedirect({
    path,
    role: ctx.role,
    currentLevel: (aal?.currentLevel ?? null) as Aal,
    nextLevel: (aal?.nextLevel ?? null) as Aal,
    hasVerifiedTotp: ctx.hasVerifiedTotp,
  });
  if (dest) redirect(dest);

  return ctx;
}
