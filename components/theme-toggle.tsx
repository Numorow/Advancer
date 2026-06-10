"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Light/dark switch — persists to localStorage; the root layout's boot script
 *  applies the saved theme before paint. */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      className={
        "rounded-md p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] " +
        (className ?? "")
      }
    >
      {/* render both, CSS picks one — avoids a hydration flash */}
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
