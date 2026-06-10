import Link from "next/link";
import { Bell } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attentionBadge } from "@/lib/calc/attention";
import { getOrgAttention } from "@/lib/attention/server";
import type { PresenceMember } from "@/lib/presence/avatars";
import { PresenceAvatars } from "./presence-avatars";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireContext();
  const attention = await getOrgAttention();
  const badge = attentionBadge(attention.total);

  // Org members for the live presence avatar row (profiles batch-fetched —
  // there's no FK between organisation_members and profiles).
  let presenceMembers: PresenceMember[] = [];
  if (ctx.orgId) {
    const supabase = await createClient();
    const { data: members } = await supabase
      .from("organisation_members")
      .select("user_id, role")
      .eq("org_id", ctx.orgId);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, email, full_name, avatar_path").in("id", ids)
      : { data: [] };
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const paths = (profiles ?? [])
      .map((p) => p.avatar_path)
      .filter((p): p is string => Boolean(p));
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("avatars").createSignedUrls(paths, 3600);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }

    presenceMembers = (members ?? []).map((m) => {
      const p = pmap.get(m.user_id);
      return {
        userId: m.user_id,
        name: p?.full_name ?? null,
        email: p?.email ?? null,
        role: m.role,
        avatarUrl: p?.avatar_path ? (signed.get(p.avatar_path) ?? null) : null,
      };
    });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-[var(--card)] px-5">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/advancer-mark.png"
              alt="Advancer"
              className="h-7 w-auto"
              width={24}
              height={28}
            />
            <span className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight">Advancer</span>
              <span className="hidden text-xs text-[var(--muted-foreground)] sm:inline">
                A Kyron System
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-[var(--muted)]">
              Events
            </Link>
            <Link href="/suppliers" className="rounded-md px-3 py-1.5 hover:bg-[var(--muted)]">
              Suppliers
            </Link>
            <Link href="/import" className="rounded-md px-3 py-1.5 hover:bg-[var(--muted)]">
              Import workbook
            </Link>
            <Link href="/settings" className="rounded-md px-3 py-1.5 hover:bg-[var(--muted)]">
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {ctx.orgId && (
            <PresenceAvatars members={presenceMembers} selfId={ctx.userId} orgId={ctx.orgId} />
          )}
          <Link
            href="/attention"
            title="Needs attention"
            className="relative rounded-md p-2 hover:bg-[var(--muted)]"
          >
            <Bell className="h-4.5 w-4.5" />
            {badge && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-semibold leading-none text-white">
                {badge}
              </span>
            )}
          </Link>
          <div className="hidden text-right sm:block">
            <div className="font-medium leading-tight">{ctx.orgName || "—"}</div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {ctx.email} · {ctx.role}
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-5 py-6">{children}</main>
    </div>
  );
}
