"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditableCell } from "@/components/editable-cell";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import { rollupCrew, rollupCrewBy, shiftCostCents, type CrewShiftLite } from "@/lib/calc/crew";
import {
  updateCrewText,
  updateCrewHours,
  updateCrewQuantity,
  updateCrewRate,
  addCrewShift,
  removeCrewShift,
  importCrewFromWorkbook,
} from "./actions";

export interface CrewRow {
  id: string;
  shiftDate: string | null;
  dayLabel: string | null;
  roleName: string | null;
  person: string | null;
  quantity: number | null;
  startTime: string | null;
  finishTime: string | null;
  scheduledHours: number | null;
  actualHours: number | null;
  rateCents: number | null;
}

const lite = (r: CrewRow): CrewShiftLite => ({
  actualHours: r.actualHours,
  scheduledHours: r.scheduledHours,
  rateCents: r.rateCents,
  quantity: r.quantity,
});

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

export function CrewGrid({
  eventId,
  rows: initial,
  roleNames,
  eventDays,
}: {
  eventId: string;
  rows: CrewRow[];
  roleNames: string[];
  eventDays: { date: string; label: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(id: string, change: Partial<CrewRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  function saveText(id: string, field: "role_name" | "person" | "start_time" | "finish_time", value: string) {
    const key =
      field === "role_name" ? "roleName" : field === "person" ? "person" : field === "start_time" ? "startTime" : "finishTime";
    patch(id, { [key]: value || null } as Partial<CrewRow>);
    startTransition(() => void updateCrewText({ shiftId: id, eventId, field, value }).catch(() => {}));
  }
  function saveHours(id: string, field: "scheduled_hours" | "actual_hours", value: number | null) {
    patch(id, (field === "scheduled_hours" ? { scheduledHours: value } : { actualHours: value }) as Partial<CrewRow>);
    startTransition(() => void updateCrewHours({ shiftId: id, eventId, field, value }).catch(() => {}));
  }
  function saveRate(id: string, cents: number | null) {
    patch(id, { rateCents: cents });
    startTransition(() => void updateCrewRate({ shiftId: id, eventId, cents }).catch(() => {}));
  }
  function saveQuantity(id: string, value: number | null) {
    const qty = value == null ? 1 : Math.max(1, Math.round(value));
    patch(id, { quantity: qty });
    startTransition(() => void updateCrewQuantity({ shiftId: id, eventId, value: qty }).catch(() => {}));
  }
  function addShift(shiftDate: string | null, dayLabel: string | null) {
    startTransition(async () => {
      const { id } = await addCrewShift({ eventId, shiftDate, dayLabel });
      setRows((rs) => [
        ...rs,
        {
          id,
          shiftDate,
          dayLabel,
          roleName: null,
          person: null,
          quantity: 1,
          startTime: null,
          finishTime: null,
          scheduledHours: null,
          actualHours: null,
          rateCents: null,
        },
      ]);
    });
  }
  function removeShift(id: string) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(() => void removeCrewShift({ shiftId: id, eventId }).catch(() => setRows(prev)));
  }
  function onImport() {
    setMessage(null);
    startTransition(async () => {
      const res = await importCrewFromWorkbook({ eventId });
      if (res.error) setMessage(res.error);
      else if (res.skipped) setMessage("Crew already imported.");
      else setMessage(`Imported ${res.created} shifts from the workbook.`);
      router.refresh();
    });
  }

  // Day groups: seed with the onsite days derived from the schedule (so every onsite
  // day shows a heading even with zero shifts), then slot shifts in by date. The phase
  // label from the schedule takes precedence over any manual day_label.
  const derivedLabel = new Map(eventDays.map((d) => [d.date, d.label]));
  const groupsMap = new Map<string, { key: string; date: string | null; label: string | null; items: CrewRow[] }>();
  for (const d of eventDays) {
    groupsMap.set(d.date, { key: d.date, date: d.date, label: d.label || null, items: [] });
  }
  for (const r of rows) {
    const key = r.shiftDate ?? "undated";
    let g = groupsMap.get(key);
    if (!g) {
      g = { key, date: r.shiftDate, label: r.dayLabel, items: [] };
      groupsMap.set(key, g);
    }
    g.items.push(r);
    if (r.shiftDate && derivedLabel.has(r.shiftDate)) g.label = derivedLabel.get(r.shiftDate) || g.label;
    else if (!g.label && r.dayLabel) g.label = r.dayLabel;
  }
  const groups = [...groupsMap.values()].sort((a, b) => {
    if (a.key === "undated") return 1;
    if (b.key === "undated") return -1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  const grand = rollupCrew(rows.map(lite));
  const byRole = rollupCrewBy(
    rows.map((r) => ({ ...lite(r), role: r.roleName ?? "Unassigned" })),
    (s) => s.role,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Scheduled hrs" value={`${grand.scheduledHours}`} />
        <Summary label="Actual hrs" value={`${grand.actualHours}`} />
        <Summary label="Labour ex-GST" value={formatCents(grand.exGstCents)} />
        <Summary label="Labour inc-GST" value={formatCents(grand.incGstCents)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => addShift(null, null)} disabled={pending}>
          Add shift
        </Button>
        {rows.length === 0 && (
          <Button size="sm" onClick={onImport} disabled={pending}>
            Import crew from workbook
          </Button>
        )}
        {message && <span className="text-sm text-[var(--muted-foreground)]">{message}</span>}
      </div>

      {byRole.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {byRole.map((g) => (
            <span key={g.key} className="rounded-full bg-[var(--muted)] px-2.5 py-1">
              {g.key}: <span className="font-medium">{formatCents(g.rollup.exGstCents)}</span> · {g.rollup.actualHours}h
            </span>
          ))}
        </div>
      )}

      <datalist id="crew-roles">
        {roleNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              <Th className="w-[18%]">Role</Th>
              <Th className="w-14 text-right">Qty</Th>
              <Th>Person</Th>
              <Th>Start</Th>
              <Th>Finish</Th>
              <Th className="text-right">Sched</Th>
              <Th className="text-right">Actual</Th>
              <Th className="text-right">Rate $/hr</Th>
              <Th className="text-right">Total</Th>
              <Th></Th>
            </tr>
          </thead>
          {groups.map((g) => {
            const sub = rollupCrew(g.items.map(lite));
            return (
              <tbody key={g.key}>
                <tr className="bg-[var(--accent)]/40">
                  <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
                    {formatDate(g.date)}
                    {g.label ? ` · ${g.label}` : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">{sub.scheduledHours}</td>
                  <td className="px-3 py-1.5 text-right text-xs">{sub.actualHours}</td>
                  <td></td>
                  <td className="px-3 py-1.5 text-right text-xs font-medium">{formatCents(sub.exGstCents)}</td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => addShift(g.date, g.label)}
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      + shift
                    </button>
                  </td>
                </tr>
                {g.items.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-[var(--muted)]/40">
                    <td className="px-2 py-1">
                      <input
                        list="crew-roles"
                        defaultValue={r.roleName ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (r.roleName ?? "")) saveText(r.id, "role_name", e.target.value);
                        }}
                        className="w-full rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-[var(--muted)]"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <NumInput value={r.quantity ?? 1} onSave={(v) => saveQuantity(r.id, v)} />
                    </td>
                    <td className="px-2 py-1">
                      <EditableCell value={r.person} placeholder="—" onSave={(v) => saveText(r.id, "person", v)} />
                    </td>
                    <td className="px-2 py-1">
                      <TimeInput value={r.startTime} onSave={(v) => saveText(r.id, "start_time", v)} />
                    </td>
                    <td className="px-2 py-1">
                      <TimeInput value={r.finishTime} onSave={(v) => saveText(r.id, "finish_time", v)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <NumInput value={r.scheduledHours} onSave={(v) => saveHours(r.id, "scheduled_hours", v)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <NumInput value={r.actualHours} onSave={(v) => saveHours(r.id, "actual_hours", v)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <MoneyInput cents={r.rateCents} onSave={(c) => saveRate(r.id, c)} />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCents(shiftCostCents(lite(r)))}</td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeShift(r.id)}
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
                <td colSpan={10} className="px-3 py-10 text-center text-[var(--muted-foreground)]">
                  No crew shifts yet. Import them from the workbook, or add a shift.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

function TimeInput({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  return (
    <input
      type="time"
      defaultValue={value ?? ""}
      onChange={(e) => onSave(e.target.value)}
      className="w-full rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-[var(--muted)]"
    />
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-[var(--card)] p-3">
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
