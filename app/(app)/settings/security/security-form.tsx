"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FactorLite {
  id: string;
  status: "verified" | "unverified";
  createdAt: string;
}

interface Enrolling {
  factorId: string;
  qr: string; // SVG data URI from supabase
  secret: string;
}

/**
 * TOTP enrolment/management. All supabase.auth.mfa.* calls are client-side;
 * verification itself steps the session up to aal2, audit rows come from the
 * DB triggers on auth.mfa_factors (0014).
 */
export function SecurityForm({
  factors,
  mfaRequired,
  enrolRequired,
}: {
  factors: FactorLite[];
  mfaRequired: boolean;
  enrolRequired: boolean;
}) {
  const router = useRouter();
  const verified = factors.find((f) => f.status === "verified") ?? null;
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnrol() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Clear out abandoned half-enrolments so they don't pile up.
    for (const f of factors.filter((f) => f.status === "unverified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      setError(error?.message ?? "Could not start enrolment.");
      setBusy(false);
      return;
    }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setBusy(false);
  }

  async function confirmEnrol(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: enrolling.factorId,
    });
    if (chErr || !ch) {
      setError(chErr?.message ?? "Could not verify.");
      setBusy(false);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    if (vErr) {
      setError("That code didn't match — check your authenticator app and try again.");
      setBusy(false);
      return;
    }
    setEnrolling(null);
    setCode("");
    setBusy(false);
    router.refresh();
  }

  async function unenrol() {
    if (!verified) return;
    if (mfaRequired && !window.confirm("Two-factor is required for your role — you'll be asked to re-enrol immediately. Continue?")) {
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    if (error) setError(error.message);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {enrolRequired && !verified && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Your role ({mfaRequired ? "owner/admin" : "member"}) requires two-factor
          authentication. Set it up below to continue using Advancer.
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Authenticator app (TOTP)</div>
              <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {verified
                  ? `Enabled ${new Date(verified.createdAt).toLocaleDateString("en-AU")}`
                  : mfaRequired
                    ? "Required for owners and admins"
                    : "Optional — recommended for everyone"}
              </div>
            </div>
            {verified ? (
              <Badge tone="info">enabled</Badge>
            ) : (
              <Badge tone="warning">not set up</Badge>
            )}
          </div>

          {!verified && !enrolling && (
            <Button onClick={startEnrol} disabled={busy}>
              {busy ? "Preparing…" : "Set up two-factor"}
            </Button>
          )}

          {enrolling && (
            <form onSubmit={confirmEnrol} className="space-y-3 rounded-md border bg-[var(--muted)]/30 p-4">
              <p className="text-sm">
                Scan this QR code with your authenticator app (Google Authenticator, 1Password,
                Authy…), then enter the 6-digit code it shows.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrolling.qr} alt="TOTP QR code" className="h-44 w-44 rounded bg-white p-2" />
              <p className="break-all text-xs text-[var(--muted-foreground)]">
                Can&#39;t scan? Enter this key manually: <code>{enrolling.secret}</code>
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  autoFocus
                  className="h-9 w-28 rounded-md border bg-[var(--card)] px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <Button type="submit" disabled={busy || code.trim().length !== 6}>
                  {busy ? "Verifying…" : "Verify & enable"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEnrolling(null);
                    setCode("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {verified && (
            <Button variant="outline" onClick={unenrol} disabled={busy}>
              {busy ? "Working…" : "Remove two-factor"}
            </Button>
          )}

          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
