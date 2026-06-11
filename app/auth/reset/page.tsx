"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Set a new password after arriving from a recovery email (via /auth/confirm).
 * MFA-enrolled users land here at aal1 where updateUser would be rejected —
 * they're bounced through the /auth/mfa challenge first.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setHasSession(false);
        setReady(true);
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
        router.replace("/auth/mfa?next=/auth/reset");
        return;
      }
      setHasSession(true);
      setReady(true);
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--background)] to-[var(--muted)] p-6">
      <div className="w-full max-w-sm animate-fade-up">
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight">Set a new password</h1>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">Advancer — A Kyron System</p>

        {!ready ? null : !hasSession ? (
          <div className="rounded-[var(--radius)] border bg-[var(--card)] p-6 text-center shadow-sm">
            <p className="text-sm text-[var(--muted-foreground)]">
              This reset link has expired or was already used.
            </p>
            <Link href="/login" className="mt-3 inline-block text-sm font-medium underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-[var(--radius)] border bg-[var(--card)] p-6 shadow-sm">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={10}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <p className="text-xs text-[var(--muted-foreground)]">At least 10 characters.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
