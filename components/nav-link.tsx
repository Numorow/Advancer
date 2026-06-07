"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  exact,
  disabled,
  children,
}: {
  href: string;
  exact?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  if (disabled) {
    return (
      <span className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-1.5 text-sm text-[var(--muted-foreground)] opacity-60">
        {children}
        <span className="text-[10px] uppercase tracking-wide">soon</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
          : "hover:bg-[var(--muted)]",
      )}
    >
      {children}
    </Link>
  );
}
