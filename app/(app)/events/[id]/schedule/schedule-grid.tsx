"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { EditableCell } from "@/components/editable-cell";
import { SCHEDULE_TYPES } from "@/lib/import/types";
import {
  type ScheduleRow,
  type SupplierOpt,
  TYPE_LABELS,
  formatDateLabel,
  groupByDate,
} from "./schedule-shared";
import type { ScheduleHandlers } from "./schedule-view";

const COLS =
  "grid grid-cols-[24px_84px_84px_112px_150px_minmax(140px,1fr)_130px_64px_52px_28px] items-center gap-2";
const cellInput =
  "h-8 w-full rounded bg-transparent px-1 text-xs outline-none focus:bg-[var(--muted)]";

export function ScheduleGrid({
  rows,
  suppliers,
  handlers,
}: {
  rows: ScheduleRow[];
  suppliers: SupplierOpt[];
  handlers: ScheduleHandlers;
}) {
  const groups = groupByDate(rows);
  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[940px]">
        <div className={`${COLS} border-b bg-[var(--muted)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]`}>
          <div></div>
          <div>Start</div>
          <div>Finish</div>
          <div>Type</div>
          <div>Supplier</div>
          <div>Action</div>
          <div>Location</div>
          <div className="text-center">Critical</div>
          <div className="text-center">Done</div>
          <div></div>
        </div>

        {groups.map((g) => (
          <Group key={g.date ?? "undated"} date={g.date} rows={g.rows} suppliers={suppliers} handlers={handlers} />
        ))}

        {groups.length === 0 && (
          <div className="px-3 py-10 text-center text-sm text-[var(--muted-foreground)]">
            No schedule entries yet.
          </div>
        )}

        <div className="border-t px-3 py-2">
          <AddButton onClick={() => handlers.addEntry(null)} label="Add undated entry" />
        </div>
      </div>
    </div>
  );
}

function Group({
  date,
  rows,
  suppliers,
  handlers,
}: {
  date: string | null;
  rows: ScheduleRow[];
  suppliers: SupplierOpt[];
  handlers: ScheduleHandlers;
}) {
  return (
    <>
      <div className="bg-[var(--accent)]/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
        {formatDateLabel(date)} · {rows.length}
      </div>
      {rows.map((r) => (
        <Row key={r.id} row={r} suppliers={suppliers} handlers={handlers} />
      ))}
      <div className="border-t px-3 py-1.5">
        <AddButton onClick={() => handlers.addEntry(date)} label="Add entry" />
      </div>
    </>
  );
}

function Row({
  row,
  suppliers,
  handlers,
}: {
  row: ScheduleRow;
  suppliers: SupplierOpt[];
  handlers: ScheduleHandlers;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t">
      <div className={`${COLS} group px-3 py-1 ${row.completed ? "bg-green-50/60" : "hover:bg-[var(--muted)]/40"}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse details" : "Expand details"}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <input
          type="time"
          value={row.startTime ?? ""}
          onChange={(e) => handlers.saveTime(row, "start_time", e.target.value)}
          className={`${cellInput} tabular-nums`}
        />
        <input
          type="time"
          value={row.finishTime ?? ""}
          onChange={(e) => handlers.saveTime(row, "finish_time", e.target.value)}
          className={`${cellInput} tabular-nums`}
        />
        <select
          value={row.type ?? ""}
          onChange={(e) => handlers.setType(row, e.target.value)}
          className={`${cellInput} cursor-pointer`}
        >
          <option value="">—</option>
          {SCHEDULE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={row.supplierId ?? ""}
          onChange={(e) => handlers.setSupplier(row, e.target.value)}
          className={`${cellInput} cursor-pointer`}
        >
          <option value="">{row.supplierText ?? "—"}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="min-w-0">
          <EditableCell value={row.action} placeholder="action" onSave={(v) => handlers.saveText(row, "action", v)} />
        </div>
        <div className="min-w-0">
          <EditableCell value={row.location} placeholder="—" onSave={(v) => handlers.saveText(row, "location", v)} />
        </div>
        <div className="text-center">
          <input
            type="checkbox"
            checked={row.criticalPath}
            onChange={(e) => handlers.toggle(row, "critical_path", e.target.checked)}
            title="Critical path"
            className="h-4 w-4 cursor-pointer accent-[var(--destructive)]"
          />
        </div>
        <div className="text-center">
          <input
            type="checkbox"
            checked={row.completed}
            onChange={(e) => handlers.toggle(row, "completed", e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
          />
        </div>
        <button
          type="button"
          onClick={() => handlers.remove(row)}
          aria-label="Delete entry"
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted-foreground)] opacity-0 transition hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="border-t bg-[var(--muted)]/30 px-3 py-3 pl-9">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs text-[var(--muted-foreground)]">Date</span>
              <input
                type="date"
                value={row.eventDate ?? ""}
                onChange={(e) => handlers.saveDate(row, e.target.value)}
                className="h-9 w-full rounded-md border bg-[var(--card)] px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--muted-foreground)]">Site point of contact</span>
              <input
                defaultValue={row.sitePoc ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (row.sitePoc ?? "")) handlers.saveText(row, "site_poc", e.target.value);
                }}
                className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
            <label className="space-y-1 sm:col-span-3">
              <span className="text-xs text-[var(--muted-foreground)]">Notes</span>
              <textarea
                defaultValue={row.notes ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (row.notes ?? "")) handlers.saveText(row, "notes", e.target.value);
                }}
                rows={2}
                className="w-full rounded-md border bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
