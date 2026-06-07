"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EditableCell } from "@/components/editable-cell";
import { Button } from "@/components/ui/button";
import type { Column, ComputedColumn } from "@/lib/infra/registers";
import {
  addInfraRow,
  updateInfraField,
  removeInfraRow,
  importInfraFromWorkbook,
} from "./actions";

export type InfraRow = Record<string, unknown> & { id: string };
export interface SupplierOpt {
  id: string;
  name: string;
}

export function RegisterGrid({
  eventId,
  table,
  columns,
  computed = [],
  rows: initial,
  suppliers,
}: {
  eventId: string;
  table: string;
  columns: Column[];
  computed?: ComputedColumn[];
  rows: InfraRow[];
  suppliers: SupplierOpt[];
}) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function onImport() {
    setMessage(null);
    startTransition(async () => {
      const res = await importInfraFromWorkbook({ eventId });
      if (res.error) setMessage(res.error);
      else setMessage(`Imported ${res.created} infrastructure rows from the workbook.`);
      router.refresh();
    });
  }

  function save(rowId: string, field: string, value: string | number | boolean | null) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
    startTransition(() => void updateInfraField({ table, rowId, eventId, field, value }).catch(() => {}));
  }

  function onAdd() {
    startTransition(async () => {
      const { id } = await addInfraRow({ table, eventId });
      const blank: InfraRow = { id };
      for (const c of columns) blank[c.key] = c.type === "bool" ? false : null;
      setRows((rs) => [...rs, blank]);
    });
  }

  function onRemove(rowId: string) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== rowId));
    startTransition(() => void removeInfraRow({ table, rowId, eventId }).catch(() => setRows(prev)));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                  {c.label}
                </th>
              ))}
              {computed.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right font-medium">
                  {c.label}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top hover:bg-[var(--muted)]/40">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-2 py-1 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}
                  >
                    <Cell
                      column={c}
                      value={r[c.key]}
                      suppliers={suppliers}
                      onSave={(v) => save(r.id, c.key, v)}
                    />
                  </td>
                ))}
                {computed.map((c) => (
                  <td key={c.key} className="px-3 py-1.5 text-right tabular-nums">
                    {c.render(r)}
                  </td>
                ))}
                <td className="px-2 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(r.id)}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                  >
                    remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + computed.length + 1} className="px-3 py-10 text-center text-[var(--muted-foreground)]">
                  Nothing here yet. Add a row to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onAdd} disabled={pending}>
          Add row
        </Button>
        {rows.length === 0 && (
          <Button size="sm" onClick={onImport} disabled={pending}>
            Import from workbook
          </Button>
        )}
        {message && <span className="text-sm text-[var(--muted-foreground)]">{message}</span>}
      </div>
    </div>
  );
}

function Cell({
  column,
  value,
  suppliers,
  onSave,
}: {
  column: Column;
  value: unknown;
  suppliers: SupplierOpt[];
  onSave: (v: string | number | boolean | null) => void;
}) {
  switch (column.type) {
    case "bool":
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onSave(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
        />
      );
    case "num":
    case "int":
      return <NumInput value={value == null ? null : Number(value)} integer={column.type === "int"} onSave={onSave} />;
    case "date":
      return (
        <input
          type="date"
          defaultValue={(value as string) ?? ""}
          onChange={(e) => onSave(e.target.value || null)}
          className="w-full rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-[var(--muted)]"
        />
      );
    case "time":
      return (
        <input
          type="time"
          defaultValue={value ? String(value).slice(0, 5) : ""}
          onChange={(e) => onSave(e.target.value || null)}
          className="w-full rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-[var(--muted)]"
        />
      );
    case "select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onSave(e.target.value || null)}
          className="w-full rounded bg-transparent py-1 text-sm capitalize outline-none focus:bg-[var(--muted)]"
        >
          <option value="">—</option>
          {(column.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "supplier":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onSave(e.target.value || null)}
          className="w-full rounded bg-transparent py-1 text-sm outline-none focus:bg-[var(--muted)]"
        >
          <option value="">—</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      );
    default:
      return <EditableCell value={(value as string) ?? null} placeholder="—" onSave={(v) => onSave(v)} />;
  }
}

function NumInput({
  value,
  integer,
  onSave,
}: {
  value: number | null;
  integer?: boolean;
  onSave: (v: number | null) => void;
}) {
  const toStr = (n: number | null) => (n == null ? "" : String(n));
  const [val, setVal] = useState(toStr(value));
  const committed = useRef(value);
  useEffect(() => {
    setVal(toStr(value));
    committed.current = value;
  }, [value]);
  function commit() {
    let next: number | null = null;
    if (val.trim() !== "") {
      const n = integer ? Math.trunc(Number(val)) : Number(val);
      next = Number.isFinite(n) ? n : null;
    }
    if (next !== committed.current) {
      committed.current = next;
      onSave(next);
    }
    setVal(toStr(next));
  }
  return (
    <input
      inputMode="decimal"
      value={val}
      placeholder="—"
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-16 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}
