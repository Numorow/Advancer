"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * App chrome: fixed left rail (desktop) / slide-over (mobile) + slim top bar.
 * Purely presentational — the rail and top-bar contents arrive server-rendered.
 */
export function AppShell({
  rail,
  topbarRight,
  children,
}: {
  rail: React.ReactNode;
  topbarRight: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // close the mobile rail after navigating
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      {/* desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-[var(--card)] lg:flex">
        {rail}
      </aside>

      {/* mobile slide-over rail */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r bg-[var(--card)] shadow-xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute right-2 top-3 rounded-md p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <X className="h-4 w-4" />
          </button>
          {rail}
        </aside>
      </div>

      {/* main column */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-[var(--background)]/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">{topbarRight}</div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
