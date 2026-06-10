import { requireContext } from "@/lib/auth";
import { NavLink } from "@/components/nav-link";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const base = "/settings";

  if (!ctx.orgId) {
    return (
      <div className="rounded-md border p-6 text-sm text-[var(--muted-foreground)]">
        You&apos;re not a member of an organisation yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:sticky lg:top-20 lg:h-fit lg:w-56 lg:shrink-0">
        <div className="mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Workspace</div>
          <h2 className="mt-0.5 text-sm font-semibold leading-tight">Settings</h2>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            {ctx.orgName} · {ctx.role}
          </div>
        </div>
        <nav className="space-y-0.5">
          <NavLink href={`${base}/profile`}>Profile</NavLink>
          <NavLink href={`${base}/members`}>Members</NavLink>
          <NavLink href={`${base}/crew-roles`}>Crew roles</NavLink>
          <NavLink href={`${base}/reference`}>Reference data</NavLink>
          <NavLink href={`${base}/activity`}>Activity log</NavLink>
        </nav>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
