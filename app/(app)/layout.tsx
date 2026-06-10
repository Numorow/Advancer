import Link from "next/link";
import { Bell, CalendarRange, LogOut, Settings2, Truck, Upload } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attentionBadge } from "@/lib/calc/attention";
import { getOrgAttention } from "@/lib/attention/server";
import type { PresenceMember } from "@/lib/presence/avatars";
import { displayName } from "@/lib/presence/avatars";
import { Avatar } from "@/components/avatar";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppShell } from "./app-shell";
import { PresenceAvatars } from "./presence-avatars";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireContext();

  // Org members for the live presence avatar row (profiles batch-fetched —
  // there's no FK between organisation_members and profiles).
  async function fetchPresenceMembers(): Promise<PresenceMember[]> {
    if (!ctx.orgId) return [];
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

    return (members ?? []).map((m) => {
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

  // Attention feed and presence members are independent — fetch concurrently.
  const [attention, presenceMembers] = await Promise.all([
    getOrgAttention(),
    fetchPresenceMembers(),
  ]);
  const badge = attentionBadge(attention.total);

  const self = presenceMembers.find((m) => m.userId === ctx.userId) ?? {
    userId: ctx.userId,
    name: null,
    email: ctx.email,
    role: ctx.role,
    avatarUrl: null,
  };

  const rail = (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/advancer-mark.png" alt="" className="h-7 w-auto dark:hidden" width={24} height={28} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/advancer-mark-white.png" alt="" className="hidden h-7 w-auto dark:block" width={24} height={28} />
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-base font-bold tracking-tight">Advancer</span>
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Kyron
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <NavLink href="/" exact icon={<CalendarRange />}>
          Events
        </NavLink>
        <NavLink href="/suppliers" icon={<Truck />}>
          Suppliers
        </NavLink>
        <NavLink href="/import" icon={<Upload />}>
          Import workbook
        </NavLink>
        <NavLink href="/settings" icon={<Settings2 />}>
          Settings
        </NavLink>
      </nav>

      <div className="shrink-0 space-y-2 border-t p-3">
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1">
          <Avatar
            userId={self.userId}
            name={self.name}
            email={self.email}
            avatarUrl={self.avatarUrl}
            size={32}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-tight">{displayName(self)}</div>
            <div className="truncate text-xs text-[var(--muted-foreground)]">
              {ctx.orgName || "No organisation"} · {ctx.role}
            </div>
          </div>
          <ThemeToggle />
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  const topbarRight = (
    <>
      {ctx.orgId && (
        <PresenceAvatars members={presenceMembers} selfId={ctx.userId} orgId={ctx.orgId} />
      )}
      <Link
        href="/attention"
        title="Needs attention"
        className="relative rounded-md p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <Bell className="h-4.5 w-4.5" />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-scale-in items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-semibold leading-none text-white">
            {badge}
          </span>
        )}
      </Link>
    </>
  );

  return (
    <AppShell rail={rail} topbarRight={topbarRight}>
      {children}
    </AppShell>
  );
}
