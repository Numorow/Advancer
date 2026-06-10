"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { EditableCell } from "@/components/editable-cell";
import { Button } from "@/components/ui/button";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import { estimateTotals, estimateVsBudget, rollupEstimateSections } from "@/lib/calc/estimate";
import {
  addEstimateItem,
  importEstimateFromWorkbook,
  removeEstimateItem,
  setBudgetLock,
  updateEstimateMoney,
  updateEstimateText,
} from "./actions";

type MoneyField = "estimate_ex_gst_cents" | "quote_ex_gst_cents" | "possible_reduction_cents";
type TextField = "description" | "notes";

export interface EstimateRow {
  id: string;
  section: string;
  description: string;
  estimateExGstCents: number;
  quoteExGstCents: number | null;
  possibleReductionCents: number | null;
  notes: string | null;
}

type Row = EstimateRow & { cid: string; pending?: boolean };

const COLS = 6;

export function EstimateView({
  eventId,
  rows: initial,
  budgetQuotedIncGstCents,
  budgetActualIncGstCents,
  locked,
  canLock,
}: {
  eventId: string;
  rows: EstimateRow[];
  budgetQuotedIncGstCents: number;
  budgetActualIncGstCents: number;
  locked: boolean;
  canLock: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => initial.map((r) => ({ ...r, cid: r.id })));
  const [newSection, setNewSection] = useState("");
  const [focusCid, setFocusCid] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tempCounter = useRef(0);

  const lines = rows.map((r) => ({
    section: r.section,
    estimateExGstCents: r.estimateExGstCents,
    quoteExGstCents: r.quoteExGstCents,
    possibleReductionCents: r.possibleReductionCents,
  }));
  const totals = estimateTotals(lines);
  const sections = rollupEstimateSections(lines);
  const vsBudget = estimateVsBudget(totals, {
    quotedIncGstCents: budgetQuotedIncGstCents,
    actualIncGstCents: budgetActualIncGstCents,
  });

  function editText(row: Row, field: TextField, value: string) {
    setRows((rs) => rs.map((r) => (r.cid === row.cid ? { ...r, [field]: value } : r)));
    if (row.pending) return;
    startTransition(async () => {
      try {
        await updateEstimateText({ itemId: row.id, eventId, field, value });
      } catch {
        /* surfaced on next load */
      }
    });
  }

  function editMoney(row: Row, field: MoneyField, cents: number | null) {
    const key =
      field === "estimate_ex_gst_cents"
        ? "estimateExGstCents"
        : field === "quote_ex_gst_cents"
          ? "quoteExGstCents"
          : "possibleReductionCents";
    setRows((rs) =>
      rs.map((r) =>
        r.cid === row.cid ? { ...r, [key]: field === "estimate_ex_gst_cents" ? (cents ?? 0) : cents } : r,
      ),
    );
    if (row.pending) return;
    startTransition(async () => {
      try {
        await updateEstimateMoney({ itemId: row.id, eventId, field, cents });
      } catch {
        /* surfaced on next load */
      }
    });
  }

  function addItem(section: string) {
    const cid = `tmp-${++tempCounter.current}`;
    setRows((rs) => [
      ...rs,
      {
        id: cid,
        cid,
        pending: true,
        section,
        description: "New line",
        estimateExGstCents: 0,
        quoteExGstCents: null,
        possibleReductionCents: null,
        notes: null,
      },
    ]);
    setFocusCid(cid);
    startTransition(async () => {
      try {
        const { id } = await addEstimateItem({ eventId, section });
        setRows((rs) => rs.map((r) => (r.cid === cid ? { ...r, id, pending: false } : r)));
      } catch {
        setRows((rs) => rs.filter((r) => r.cid !== cid));
      }
    });
  }

  function addSection() {
    const name = newSection.trim();
    if (!name) return;
    setNewSection("");
    addItem(name);
  }

  function removeItem(row: Row) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.cid !== row.cid));
    startTransition(async () => {
      try {
        await removeEstimateItem({ itemId: row.id, eventId });
      } catch {
        setRows(prev);
      }
    });
  }

  function toggleLock() {
    startTransition(async () => {
      try {
        await setBudgetLock({ eventId, locked: !locked });
        router.refresh();
      } catch {
        /* surfaced on next load */
      }
    });
  }

  function runImport() {
    setImportMsg(null);
    startTransition(async () => {
      const res = await importEstimateFromWorkbook({ eventId });
      if ("error" in res && res.error) setImportMsg(res.error);
      else if ("created" in res) {
        setImportMsg(`Imported ${res.created} estimate lines.`);
        router.refresh();
      }
    });
  }

  // pick up server-refreshed rows after import/lock
  useEffect(() => {
    setRows(initial.map((r) => ({ ...r, cid: r.id })));
  }, [initial]);

  const grouped = sections.map((s) => ({
    section: s.section,
    rollup: s,
    items: rows.filter((r) => r.section === s.section),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Estimate inc GST" value={formatCents(totals.estimateIncGstCents)} />
        <Summary label="Budget quoted inc GST" value={formatCents(vsBudget.budgetQuotedIncGstCents)} sub={`${formatCents(vsBudget.quotedVarianceCents, { showSign: true })} vs estimate`} tone={vsBudget.quotedVarianceCents > 0 ? "danger" : "success"} />
        <Summary label="Budget actual inc GST" value={formatCents(vsBudget.budgetActualIncGstCents)} sub={`${formatCents(vsBudget.actualVarianceCents, { showSign: true })} vs estimate`} tone={vsBudget.actualVarianceCents > 0 ? "danger" : "success"} />
        <Summary
          label="If all reductions taken"
          value={formatCents(totals.scenarioIncGstCents)}
          sub={totals.possibleReductionCents > 0 ? `saves ${formatCents(totals.possibleReductionCents)} ex GST` : "no reductions flagged"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {rows.length === 0 && (
            <Button size="sm" variant="outline" onClick={runImport} disabled={pending}>
              Import from workbook
            </Button>
          )}
          {importMsg && <span className="text-xs text-[var(--muted-foreground)]">{importMsg}</span>}
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <span className="text-xs font-medium text-[var(--destructive)]">
              Budget locked — money edits are blocked
            </span>
          )}
          {canLock && (
            <Button size="sm" variant={locked ? "outline" : "default"} onClick={toggleLock} disabled={pending}>
              {locked ? (
                <>
                  <LockOpen className="mr-1.5 h-3.5 w-3.5" /> Unlock budget
                </>
              ) : (
                <>
                  <Lock className="mr-1.5 h-3.5 w-3.5" /> Lock budget
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-[var(--muted)]/60 text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <Th className="w-[30%]">Item</Th>
              <Th className="w-32 text-right">Estimate ex GST</Th>
              <Th className="w-32 text-right">Quote ex GST</Th>
              <Th className="w-32 text-right">Possible reduction</Th>
              <Th>Notes</Th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <SectionRows
                key={g.section}
                section={g.section}
                items={g.items}
                rollup={g.rollup}
                focusCid={focusCid}
                onEditText={editText}
                onEditMoney={editMoney}
                onAdd={addItem}
                onRemove={removeItem}
              />
            ))}
            {grouped.length === 0 && (
              <tr>
                <td colSpan={COLS} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                  No estimate lines yet — import from the workbook or add a section below.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t bg-[var(--muted)]/60 text-xs font-medium">
              <tr>
                <td className="px-3 py-1.5">Total ex GST</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCents(totals.estimateExGstCents)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCents(totals.quoteExGstCents)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCents(totals.possibleReductionCents)}</td>
                <td colSpan={2}></td>
              </tr>
              <tr>
                <td className="px-3 py-1.5">GST</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCents(totals.estimateGstCents)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCents(totals.quoteGstCents)}</td>
                <td colSpan={3}></td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-1.5 font-semibold">Total inc GST</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatCents(totals.estimateIncGstCents)}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatCents(totals.quoteIncGstCents)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addSection();
          }}
          placeholder="New section name…"
          className="h-9 w-64 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <Button size="sm" variant="outline" onClick={addSection} disabled={!newSection.trim()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add section
        </Button>
      </div>
    </div>
  );
}

function SectionRows({
  section,
  items,
  rollup,
  focusCid,
  onEditText,
  onEditMoney,
  onAdd,
  onRemove,
}: {
  section: string;
  items: Row[];
  rollup: { estimateExGstCents: number; quoteExGstCents: number; possibleReductionCents: number };
  focusCid: string | null;
  onEditText: (row: Row, field: TextField, value: string) => void;
  onEditMoney: (row: Row, field: MoneyField, cents: number | null) => void;
  onAdd: (section: string) => void;
  onRemove: (row: Row) => void;
}) {
  return (
    <>
      <tr className="bg-[var(--accent)]/40">
        <td className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
          {section} · {items.length}
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums">
          {formatCents(rollup.estimateExGstCents)}
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums">
          {formatCents(rollup.quoteExGstCents)}
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums">
          {rollup.possibleReductionCents ? formatCents(rollup.possibleReductionCents) : ""}
        </td>
        <td colSpan={2}></td>
      </tr>
      {items.map((r) => (
        <tr
          key={r.cid}
          className={`group border-t align-top hover:bg-[var(--muted)]/40 ${r.pending ? "opacity-60" : ""}`}
        >
          <td className="px-2 py-1">
            <EditableCell
              value={r.description}
              autoFocus={r.cid === focusCid}
              onSave={(v) => onEditText(r, "description", v)}
            />
          </td>
          <td className="px-2 py-1 text-right">
            <MoneyCell cents={r.estimateExGstCents} onSave={(c) => onEditMoney(r, "estimate_ex_gst_cents", c)} />
          </td>
          <td className="px-2 py-1 text-right">
            <MoneyCell cents={r.quoteExGstCents} nullable onSave={(c) => onEditMoney(r, "quote_ex_gst_cents", c)} />
          </td>
          <td className="px-2 py-1 text-right">
            <MoneyCell cents={r.possibleReductionCents} nullable onSave={(c) => onEditMoney(r, "possible_reduction_cents", c)} />
          </td>
          <td className="px-2 py-1">
            <EditableCell value={r.notes} placeholder="—" onSave={(v) => onEditText(r, "notes", v)} />
          </td>
          <td className="px-2 py-1.5 text-right">
            <button
              type="button"
              onClick={() => onRemove(r)}
              disabled={r.pending}
              title="Delete line"
              aria-label={`Delete ${r.description}`}
              className="rounded p-1 text-[var(--muted-foreground)] opacity-0 transition hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      ))}
      <tr className="border-t">
        <td colSpan={COLS} className="px-2 py-1">
          <button
            type="button"
            onClick={() => onAdd(section)}
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add line
          </button>
        </td>
      </tr>
    </>
  );
}

/** Right-aligned money input; `nullable` saves blank as null instead of $0. */
function MoneyCell({
  cents,
  nullable,
  onSave,
}: {
  cents: number | null;
  nullable?: boolean;
  onSave: (cents: number | null) => void;
}) {
  const toInput = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));
  const [val, setVal] = useState(toInput(cents));
  const committed = useRef(cents);

  useEffect(() => {
    setVal(toInput(cents));
    committed.current = cents;
  }, [cents]);

  function commit() {
    const parsed = val.trim() === "" && nullable ? null : (dollarsToCents(val) ?? (nullable ? null : 0));
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
      placeholder={nullable ? "—" : "0.00"}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-28 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}

function Summary({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-md border bg-[var(--card)] p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && (
        <div
          className={
            "text-xs tabular-nums " +
            (tone === "danger"
              ? "text-[var(--destructive)]"
              : tone === "success"
                ? "text-[var(--success)]"
                : "text-[var(--muted-foreground)]")
          }
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
