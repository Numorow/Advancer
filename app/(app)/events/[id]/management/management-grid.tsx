"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditableCell } from "@/components/editable-cell";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import {
  rollupManagement,
  taskCostCents,
  type ManagementTaskLite,
} from "@/lib/calc/management";
import {
  updateManagementText,
  updateManagementHours,
  updateManagementRate,
  updateManagementCompleted,
  updateManagementWeek,
  addManagementTask,
  removeManagementTask,
  importManagementFromWorkbook,
} from "./actions";

export interface ManagementRow {
  id: string;
  weekDate: string | null;
  weekLabel: string | null;
  taskNo: number | null;
  task: string | null;
  hours: number | null;
  completed: boolean;
  role: string | null;
  rateCents: number | null;
}

const lite = (r: ManagementRow): ManagementTaskLite => ({
  hours: r.hours,
  rateCents: r.rateCents,
  completed: r.completed,
});

function formatWeek(iso: string | null, label: string | null): string {
  if (!iso) return label ?? "Unscheduled";
  const d = new Date(`${iso}T00:00:00Z`);
  const date = Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return label ? `${label} · ${date}` : `Week of ${date}`;
}

export function ManagementGrid({
  eventId,
  rows: initial,
  seedWeeks = [],
}: {
  eventId: string;
  rows: ManagementRow[];
  /** Monday of each week to show as a heading even when empty (this week → event end). */
  seedWeeks?: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Adopt server re-renders (foreign edits via LiveRefresh, own via revalidatePath).
  useEffect(() => setRows(initial), [initial]);

  function patch(id: string, change: Partial<ManagementRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  function saveText(id: string, field: "task" | "role", value: string) {
    patch(id, (field === "task" ? { task: value } : { role: value }) as Partial<ManagementRow>);
    startTransition(() => void updateManagementText({ taskId: id, eventId, field, value }).catch(() => {}));
  }
  function saveHours(id: string, value: number | null) {
    patch(id, { hours: value });
    startTransition(() => void updateManagementHours({ taskId: id, eventId, value }).catch(() => {}));
  }
  function saveRate(id: string, cents: number | null) {
    patch(id, { rateCents: cents });
    startTransition(() => void updateManagementRate({ taskId: id, eventId, cents }).catch(() => {}));
  }
  function toggle(id: string, value: boolean) {
    const prev = rows;
    patch(id, { completed: value });
    startTransition(() => void updateManagementCompleted({ taskId: id, eventId, value }).catch(() => setRows(prev)));
  }
  function saveWeek(id: string, weekDate: string | null) {
    patch(id, { weekDate });
    startTransition(() => void updateManagementWeek({ taskId: id, eventId, weekDate }).catch(() => {}));
  }
  function addTask(weekDate: string | null, weekLabel: string | null) {
    startTransition(async () => {
      const { id } = await addManagementTask({ eventId, weekDate, weekLabel });
      // a resync may have adopted the server row already — replace, never duplicate
      setRows((rs) => [
        ...rs.filter((r) => r.id !== id),
        { id, weekDate, weekLabel, taskNo: null, task: null, hours: null, completed: false, role: null, rateCents: null },
      ]);
    });
  }
  function remove(id: string) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(() => void removeManagementTask({ taskId: id, eventId }).catch(() => setRows(prev)));
  }
  function onImport() {
    setMessage(null);
    startTransition(async () => {
      const res = await importManagementFromWorkbook({ eventId });
      if (res.error) setMessage(res.error);
      else if (res.skipped) setMessage("Management already imported.");
      else setMessage(`Imported ${res.created} tasks from the workbook.`);
      router.refresh();
    });
  }

  // Week groups: seed a heading per upcoming week (so the plan skeleton is
  // always visible), then slot tasks in by their week date. Unscheduled tasks
  // (e.g. fresh checklist mirrors) stay in a group at the top.
  const groups: { key: string; date: string | null; label: string | null; items: ManagementRow[] }[] =
    seedWeeks.map((d) => ({ key: d, date: d, label: null, items: [] }));
  for (const r of rows) {
    const key = r.weekDate ?? "unscheduled";
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, date: r.weekDate, label: r.weekLabel, items: [] };
      groups.push(g);
    }
    if (!g.label && r.weekLabel) g.label = r.weekLabel;
    g.items.push(r);
  }
  groups.sort((a, b) => {
    if (a.key === "unscheduled") return -1;
    if (b.key === "unscheduled") return 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  const grand = rollupManagement(rows.map(lite));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Tasks" value={`${grand.completedTasks}/${grand.tasks}`} sub={`${grand.pct}% done`} />
        <Summary label="Est. hours" value={`${grand.hours}`} />
        <Summary label="Mgmt cost ex-GST" value={formatCents(grand.exGstCents)} />
        <Summary label="Mgmt cost inc-GST" value={formatCents(grand.incGstCents)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => addTask(null, null)} disabled={pending}>
          Add task
        </Button>
        {rows.length === 0 && (
          <Button size="sm" onClick={onImport} disabled={pending}>
            Import from workbook
          </Button>
        )}
        {message && <span className="text-sm text-[var(--muted-foreground)]">{message}</span>}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-[var(--muted)]/60 text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <Th className="w-[30%]">Task</Th>
              <Th>Role</Th>
              <Th className="w-36">Week</Th>
              <Th className="text-right">Hours</Th>
              <Th className="text-right">Rate $/hr</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-center">Done</Th>
              <Th></Th>
            </tr>
          </thead>
          {groups.map((g) => {
            const sub = rollupManagement(g.items.map(lite));
            return (
              <tbody key={g.key}>
                <tr className="bg-[var(--accent)]/40">
                  <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
                    {formatWeek(g.date, g.label)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">{sub.hours}h</td>
                  <td></td>
                  <td className="px-3 py-1.5 text-right text-xs font-medium">{formatCents(sub.exGstCents)}</td>
                  <td className="px-3 py-1.5 text-center text-xs">{sub.pct}%</td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => addTask(g.date, g.label)}
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      + task
                    </button>
                  </td>
                </tr>
                {g.items.map((r) => (
                  <tr key={r.id} className={`border-t ${r.completed ? "bg-green-50/60 dark:bg-green-500/10" : "hover:bg-[var(--muted)]/40"}`}>
                    <td className="px-2 py-1">
                      <EditableCell value={r.task} placeholder="task" onSave={(v) => saveText(r.id, "task", v)} />
                    </td>
                    <td className="px-2 py-1">
                      <EditableCell value={r.role} placeholder="—" onSave={(v) => saveText(r.id, "role", v)} />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="date"
                        value={r.weekDate ?? ""}
                        onChange={(e) => saveWeek(r.id, e.target.value || null)}
                        className="w-full rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-[var(--muted)]"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <NumInput value={r.hours} onSave={(v) => saveHours(r.id, v)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <MoneyInput cents={r.rateCents} onSave={(c) => saveRate(r.id, c)} />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCents(taskCostCents(r.hours, r.rateCents))}</td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={r.completed}
                        onChange={(e) => toggle(r.id, e.target.checked)}
                        className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                      >
                        remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
          {groups.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-[var(--muted-foreground)]">
                  No management tasks yet. Import them from the workbook, or add a task.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

function NumInput({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const toStr = (n: number | null) => (n == null ? "" : String(n));
  const [val, setVal] = useState(toStr(value));
  const committed = useRef(value);
  useEffect(() => {
    setVal(toStr(value));
    committed.current = value;
  }, [value]);
  function commit() {
    const parsed = val.trim() === "" ? null : Number(val);
    const next = parsed != null && Number.isFinite(parsed) ? parsed : null;
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

function MoneyInput({ cents, onSave }: { cents: number | null; onSave: (cents: number | null) => void }) {
  const toInput = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2));
  const [val, setVal] = useState(toInput(cents));
  const committed = useRef(cents);
  useEffect(() => {
    setVal(toInput(cents));
    committed.current = cents;
  }, [cents]);
  function commit() {
    const parsed = val.trim() === "" ? null : dollarsToCents(val);
    if (parsed !== committed.current) {
      committed.current = parsed;
      onSave(parsed);
    }
    setVal(toInput(parsed));
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
      className="w-20 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-[var(--card)] p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-[var(--muted-foreground)]">{sub}</div>}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
