import Link from "next/link";
import { requireContext } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireContext();

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
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
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
