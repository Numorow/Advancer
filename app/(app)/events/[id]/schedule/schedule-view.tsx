"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { SCHEDULE_TYPES } from "@/lib/import/types";
import {
  type ScheduleRow,
  type SupplierOpt,
  TYPE_LABELS,
  supplierLabel,
} from "./schedule-shared";
import { ScheduleGrid } from "./schedule-grid";
import { ScheduleTimeline } from "./schedule-timeline";
import {
  addScheduleEntry,
  removeScheduleEntry,
  updateScheduleToggle,
  updateScheduleType,
  updateScheduleText,
  updateScheduleTime,
  updateScheduleDate,
  updateScheduleSupplier,
} from "./actions";

export type TextField = "action" | "location" | "site_poc" | "notes";
export type TimeField = "start_time" | "finish_time";

export interface ScheduleHandlers {
  toggle: (row: ScheduleRow, field: "completed" | "critical_path", value: boolean) => void;
  setType: (row: ScheduleRow, value: string) => void;
  saveText: (row: ScheduleRow, field: TextField, value: string) => void;
  saveTime: (row: ScheduleRow, field: TimeField, value: string) => void;
  saveDate: (row: ScheduleRow, value: string) => void;
  setSupplier: (row: ScheduleRow, supplierId: string) => void;
  addEntry: (eventDate: string | null) => void;
  remove: (row: ScheduleRow) => void;
}

function blankRow(id: string, eventDate: string | null): ScheduleRow {
  return {
    id,
    eventDate,
    startTime: null,
    finishTime: null,
    type: null,
    supplierId: null,
    supplierText: null,
    supplierName: null,
    action: null,
    location: null,
    sitePoc: null,
    notes: null,
    completed: false,
    criticalPath: false,
    sort: 9999,
  };
}

export function ScheduleView({
  eventId,
  rows: initial,
  suppliers,
}: {
  eventId: string;
  rows: ScheduleRow[];
  suppliers: SupplierOpt[];
}) {
  const [rows, setRows] = useState(initial);
  const [view, setView] = useState<"grid" | "timeline">("grid");
  const [text, setText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [doneFilter, setDoneFilter] = useState<"all" | "open" | "done">("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [, startTransition] = useTransition();

  // Adopt server re-renders (foreign edits via LiveRefresh, own via revalidatePath).
  useEffect(() => setRows(initial), [initial]);

  function patch(id: string, change: Partial<ScheduleRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  const handlers: ScheduleHandlers = {
    toggle(row, field, value) {
      const prev = rows;
      patch(row.id, field === "completed" ? { completed: value } : { criticalPath: value });
      startTransition(() =>
        void updateScheduleToggle({ entryId: row.id, eventId, field, value }).catch(() => setRows(prev)),
      );
    },
    setType(row, value) {
      patch(row.id, { type: value || null });
      startTransition(() => void updateScheduleType({ entryId: row.id, eventId, value: value || null }).catch(() => {}));
    },
    saveText(row, field, value) {
      const key: keyof ScheduleRow =
        field === "action" ? "action" : field === "location" ? "location" : field === "site_poc" ? "sitePoc" : "notes";
      patch(row.id, { [key]: value || null } as Partial<ScheduleRow>);
      startTransition(() => void updateScheduleText({ entryId: row.id, eventId, field, value }).catch(() => {}));
    },
    saveTime(row, field, value) {
      patch(row.id, (field === "start_time" ? { startTime: value || null } : { finishTime: value || null }) as Partial<ScheduleRow>);
      startTransition(() => void updateScheduleTime({ entryId: row.id, eventId, field, value: value || null }).catch(() => {}));
    },
    saveDate(row, value) {
      patch(row.id, { eventDate: value || null });
      startTransition(() => void updateScheduleDate({ entryId: row.id, eventId, value: value || null }).catch(() => {}));
    },
    setSupplier(row, supplierId) {
      const name = supplierId ? suppliers.find((s) => s.id === supplierId)?.name ?? null : null;
      patch(row.id, { supplierId: supplierId || null, supplierName: name, supplierText: supplierId ? null : row.supplierText });
      startTransition(() =>
        void updateScheduleSupplier({ entryId: row.id, eventId, supplierId: supplierId || null }).catch(() => {}),
      );
    },
    addEntry(eventDate) {
      startTransition(async () => {
        try {
          const { id } = await addScheduleEntry({ eventId, eventDate });
          // a resync may have adopted the server row already
          setRows((rs) => (rs.some((r) => r.id === id) ? rs : [...rs, blankRow(id, eventDate)]));
        } catch {
          /* surfaced on next load */
        }
      });
    },
    remove(row) {
      const prev = rows;
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      startTransition(() => void removeScheduleEntry({ entryId: row.id, eventId }).catch(() => setRows(prev)));
    },
  };

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (doneFilter === "open" && r.completed) return false;
      if (doneFilter === "done" && !r.completed) return false;
      if (criticalOnly && !r.criticalPath) return false;
      if (q) {
        const hay = `${r.action ?? ""} ${r.location ?? ""} ${supplierLabel(r) ?? ""} ${r.sitePoc ?? ""} ${r.notes ?? ""}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, text, typeFilter, doneFilter, criticalOnly]);

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
        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border bg-[var(--card)] px-2.5 text-sm">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={(e) => setCriticalOnly(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--destructive)]"
          />
          Critical only
        </label>

        <div className="ml-auto inline-flex overflow-hidden rounded-md border">
          <ViewTab active={view === "grid"} onClick={() => setView("grid")}>
            Grid
          </ViewTab>
          <ViewTab active={view === "timeline"} onClick={() => setView("timeline")}>
            Timeline
          </ViewTab>
        </div>
      </div>

      {view === "grid" ? (
        <ScheduleGrid rows={filtered} suppliers={suppliers} handlers={handlers} />
      ) : (
        <ScheduleTimeline rows={filtered} onToggle={handlers.toggle} />
      )}
    </div>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm ${active ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--card)] hover:bg-[var(--muted)]"}`}
    >
      {children}
    </button>
  );
}
