"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function MfaChallengePage() {
  return (
    <Suspense fallback={null}>
      <MfaChallenge />
    </Suspense>
  );
}

/**
 * Session step-up: an enrolled user lands here at aal1 and verifies a TOTP
 * code to reach aal2. Public path (/auth) so the MFA policy can't loop.
 */
function MfaChallenge() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [factorId, setFactorId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "no-session">("loading");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setState("no-session");
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = (data?.totp ?? [])[0] ?? null;
      if (!totp) {
        // Nothing to challenge — bounce home (policy won't send us back).
        router.replace("/");
        return;
      }
      setFactorId(totp.id);
      setState("ready");
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setError(chErr?.message ?? "Could not start the check — try again.");
      setBusy(false);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    if (vErr) {
      setError("That code didn't match — try the next one from your app.");
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--background)] to-[var(--muted)] p-6">
      <div className="w-full max-w-sm animate-fade-up">
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight">Two-factor check</h1>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
          Enter the 6-digit code from your authenticator app.
        </p>

        {state === "no-session" && (
          <div className="rounded-[var(--radius)] border bg-[var(--card)] p-6 text-center shadow-sm">
            <p className="text-sm text-[var(--muted-foreground)]">Your session has ended.</p>
            <a href="/login" className="mt-3 inline-block text-sm font-medium underline">
              Back to sign in
            </a>
          </div>
        )}

        {state === "ready" && (
          <>
            <form onSubmit={onSubmit} className="space-y-4 rounded-[var(--radius)] border bg-[var(--card)] p-6 shadow-sm">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                autoFocus
                className="h-11 w-full rounded-md border bg-[var(--card)] px-3 text-center text-lg tabular-nums tracking-[0.3em] outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || code.trim().length !== 6}>
                {busy ? "Checking…" : "Verify"}
              </Button>
            </form>
            <form action="/auth/signout" method="post" className="mt-3 text-center">
              <button
                type="submit"
                className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
              >
                Sign out instead
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
