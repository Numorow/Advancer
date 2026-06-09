"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Inline text cell that saves on blur (or Enter) when the value changed. */
export function EditableCell({
  value,
  placeholder,
  className,
  autoFocus,
  onSave,
}: {
  value: string | null;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSave: (value: string) => void;
}) {
  const [val, setVal] = useState(value ?? "");
  const committed = useRef(value ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVal(value ?? "");
    committed.current = value ?? "";
  }, [value]);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [autoFocus]);

  function commit() {
    if (val !== committed.current) {
      committed.current = val;
      onSave(val);
    }
  }

  return (
    <input
      ref={ref}
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        "w-full rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-[var(--muted)]",
        className,
      )}
    />
  );
}
