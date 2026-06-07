"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EditableCell } from "@/components/editable-cell";
import { Badge } from "@/components/ui/badge";
import { SCHEDULE_TYPES } from "@/lib/import/types";
import { updateScheduleToggle, updateScheduleType, updateScheduleText } from "./actions";

export interface ScheduleRow {
  id: string;
  eventDate: string | null;
  startTime: string | null;
  finishTime: string | null;
  type: string | null;
  action: string | null;
  location: string | null;
  sitePoc: string | null;
  notes: string | null;
  completed: boolean;
  criticalPath: boolean;
  supplier: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  ON_SITE: "On-site",
  INSTALL: "Install",
  COLLECTION: "Collection",
  DELIVERY: "Delivery",
  SHOW_TIME: "Show time",
  BUMP_OUT: "Bump out",
  DROP_OFF: "Drop off",
  PICK_UP: "Pick up",
  SECURITY: "Security",
};

const COLS = "grid grid-cols-[92px_116px_minmax(0,1fr)_150px_130px_64px] items-center gap-2";

type DisplayItem =
  | { kind: "header"; key: string; date: string | null; count: number }
  | { kind: "entry"; key: string; row: ScheduleRow };

function formatDate(iso: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ScheduleGrid({
  eventId,
  rows: initial,
}: {
  eventId: string;
  rows: ScheduleRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [text, setText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [doneFilter, setDoneFilter] = useState<"all" | "open" | "done">("all");
  const [, startTransition] = useTransition();
  const parentRef = useRef<HTMLDivElement>(null);

  function patch(id: string, change: Partial<ScheduleRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  function toggle(id: string, field: "completed" | "critical_path", value: boolean) {
    const prev = rows;
    patch(id, field === "completed" ? { completed: value } : { criticalPath: value });
    startTransition(async () => {
      try {
        await updateScheduleToggle({ entryId: id, eventId, field, value });
      } catch {
        setRows(prev);
      }
    });
  }

  function setType(id: string, value: string) {
    const prev = rows;
    patch(id, { type: value || null });
    startTransition(async () => {
      try {
        await updateScheduleType({ entryId: id, eventId, value: value || null });
      } catch {
        setRows(prev);
      }
    });
  }

  function saveText(id: string, field: "action" | "location" | "site_poc", value: string) {
    patch(
      id,
      field === "action" ? { action: value } : field === "location" ? { location: value } : { sitePoc: value },
    );
    startTransition(async () => {
      try {
        await updateScheduleText({ entryId: id, eventId, field, value });
      } catch {
        /* revalidated on next load */
      }
    });
  }

  const display = useMemo<DisplayItem[]>(() => {
    const q = text.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (doneFilter === "open" && r.completed) return false;
      if (doneFilter === "done" && !r.completed) return false;
      if (q) {
        const hay = `${r.action ?? ""} ${r.location ?? ""} ${r.supplier ?? ""} ${r.sitePoc ?? ""} ${r.notes ?? ""}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    const items: DisplayItem[] = [];
    let currentDate: string | null | undefined = undefined;
    let headerIndex = -1;
    for (const r of filtered) {
      if (r.eventDate !== currentDate) {
        currentDate = r.eventDate;
        items.push({ kind: "header", key: `h-${r.eventDate}`, date: r.eventDate, count: 0 });
        headerIndex = items.length - 1;
      }
      if (headerIndex >= 0) (items[headerIndex] as { count: number }).count += 1;
      items.push({ kind: "entry", key: r.id, row: r });
    }
    return items;
  }, [rows, text, typeFilter, doneFilter]);

  const virtualizer = useVirtualizer({
    count: display.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (display[i].kind === "header" ? 34 : 44),
    overscan: 12,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Filter ${rows.length} entries…`}
          className="h-9 w-full max-w-xs rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm"
        >
          <option value="">All types</option>
          {SCHEDULE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={doneFilter}
          onChange={(e) => setDoneFilter(e.target.value as "all" | "open" | "done")}
          className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm"
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="done">Completed</option>
        </select>
      </div>

      <div className="rounded-md border">
        <div className={`${COLS} border-b bg-[var(--muted)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]`}>
          <div>Time</div>
          <div>Type</div>
          <div>Action</div>
          <div>Location</div>
          <div>Supplier</div>
          <div className="text-center">Done</div>
        </div>

        <div ref={parentRef} className="h-[620px] overflow-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const item = display[vi.index];
              return (
                <div
                  key={item.key}
                  className="absolute left-0 top-0 w-full"
                  style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
                >
                  {item.kind === "header" ? (
                    <div className="flex h-full items-center gap-2 bg-[var(--accent)]/40 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
                      {formatDate(item.date)} · {item.count}
                    </div>
                  ) : (
                    <Row row={item.row} onToggle={toggle} onType={setType} onText={saveText} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  row,
  onToggle,
  onType,
  onText,
}: {
  row: ScheduleRow;
  onToggle: (id: string, field: "completed" | "critical_path", value: boolean) => void;
  onType: (id: string, value: string) => void;
  onText: (id: string, field: "action" | "location" | "site_poc", value: string) => void;
}) {
  return (
    <div className={`${COLS} border-t px-3 ${row.completed ? "bg-green-50/60" : "hover:bg-[var(--muted)]/40"}`}>
      <div className="text-xs tabular-nums text-[var(--muted-foreground)]">
        {row.startTime ?? "—"}
        {row.finishTime ? `–${row.finishTime}` : ""}
      </div>
      <div>
        <select
          value={row.type ?? ""}
          onChange={(e) => onType(row.id, e.target.value)}
          className="w-full rounded bg-transparent py-1 text-xs outline-none focus:bg-[var(--muted)]"
        >
          <option value="">—</option>
          {SCHEDULE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <EditableCell value={row.action} placeholder="action" onSave={(v) => onText(row.id, "action", v)} />
      </div>
      <div className="min-w-0">
        <EditableCell value={row.location} placeholder="—" onSave={(v) => onText(row.id, "location", v)} />
      </div>
      <div className="truncate text-xs text-[var(--muted-foreground)]" title={row.supplier ?? ""}>
        {row.supplier ?? "—"}
        {row.criticalPath && (
          <Badge tone="danger" className="ml-1">
            critical
          </Badge>
        )}
      </div>
      <div className="text-center">
        <input
          type="checkbox"
          checked={row.completed}
          onChange={(e) => onToggle(row.id, "completed", e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
        />
      </div>
    </div>
  );
}
