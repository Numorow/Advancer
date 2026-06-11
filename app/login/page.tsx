"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "link_expired"
      ? "That link has expired or was already used — request a new one."
      : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();

    if (mode === "forgot") {
      // Always report success — no user enumeration.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset`,
      });
      setInfo("If an account exists for that email, a reset link is on its way.");
      setMode("signin");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // picked up by the handle_new_user trigger → profiles.full_name
          data: { full_name: fullName.trim() || undefined },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setInfo("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    router.replace(params.get("next") || "/");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--background)] to-[var(--muted)] p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/advancer-mark.png"
            alt="Advancer"
            className="mb-3 h-14 w-auto dark:hidden"
            width={47}
            height={56}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/advancer-mark-white.png"
            alt="Advancer"
            className="mb-3 hidden h-14 w-auto dark:block"
            width={47}
            height={56}
          />
          <h1 className="text-2xl font-bold tracking-tight">Advancer</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            A Kyron System — event advancement command centre
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-[var(--radius)] border bg-[var(--card)] p-6 shadow-sm"
        >
          <div className="flex rounded-md border p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded px-3 py-1.5 ${mode === "signin" ? "bg-[var(--muted)] font-medium" : ""}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded px-3 py-1.5 ${mode === "signup" ? "bg-[var(--muted)] font-medium" : ""}`}
            >
              Create account
            </button>
          </div>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="fullName">
                Your name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Kyle Bailey"
                className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setInfo(null);
                    }}
                    className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                required
                minLength={mode === "signup" ? 10 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              {mode === "signup" && (
                <p className="text-xs text-[var(--muted-foreground)]">At least 10 characters.</p>
              )}
            </div>
          )}
          {mode === "forgot" && (
            <p className="text-xs text-[var(--muted-foreground)]">
              We&#39;ll email you a link to set a new password.
            </p>
          )}
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
          {info && <p className="text-sm text-[var(--success)]">{info}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Sign in"}
          </Button>
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full text-center text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
            >
              Back to sign in
            </button>
          )}
          {mode === "signup" && (
            <p className="text-xs text-[var(--muted-foreground)]">
              The first account becomes the Kyron organisation owner.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
