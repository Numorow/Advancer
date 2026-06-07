"use client";

import { Badge } from "@/components/ui/badge";
import { statusMeta, nextStatus, type StatusField } from "@/lib/status";

export function StatusButton({
  field,
  value,
  disabled,
  onCycle,
}: {
  field: StatusField;
  value: string;
  disabled?: boolean;
  onCycle: (next: string) => void;
}) {
  const meta = statusMeta(field, value);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onCycle(nextStatus(field, value))}
      title="Click to advance"
      className="cursor-pointer disabled:cursor-default"
    >
      <Badge tone={meta.tone}>{meta.label}</Badge>
    </button>
  );
}
