import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/org/members";
import { SecurityForm } from "./security-form";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ enrol?: string }>;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const all = data?.all ?? [];
  const totp = all.filter((f) => f.factor_type === "totp");
  const { enrol } = await searchParams;

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Two-factor authentication protects your account with a one-time code from an
          authenticator app, on top of your password.
        </p>
      </div>
      <SecurityForm
        factors={totp.map((f) => ({
          id: f.id,
          status: f.status,
          createdAt: f.created_at,
        }))}
        mfaRequired={isAdminRole(ctx.role)}
        enrolRequired={enrol === "required"}
      />
    </div>
  );
}
