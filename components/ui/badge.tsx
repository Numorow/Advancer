import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "muted" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  default: "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
  muted: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-indigo-100 text-indigo-700",
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
