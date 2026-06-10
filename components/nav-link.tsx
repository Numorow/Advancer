"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  exact,
  disabled,
  icon,
  children,
}: {
  href: string;
  exact?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
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
        "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-150",
        active
          ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--primary)]" />
      )}
      {icon && (
        <span className={cn("shrink-0 [&>svg]:h-4 [&>svg]:w-4", active && "text-[var(--foreground)]")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Link>
  );
}
