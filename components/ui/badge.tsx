import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "muted" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  default: "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
  muted: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  success: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  info: "bg-zinc-200/70 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-300",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
