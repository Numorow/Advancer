"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { StatusButton } from "@/components/status-button";
import { EditableCell } from "@/components/editable-cell";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import { rollupBudget, type BudgetLine } from "@/lib/calc/budget";
import {
  ensureBudgetItem,
  removeBudgetItemOnly,
  updateBudgetMoney,
  updateBudgetStatus,
  updateBudgetText,
} from "./actions";
import { addChecklistItem, removeChecklistItem, updateChecklistText } from "../checklist/actions";
import { raiseRfqFromBudget } from "../rfqs/actions";

type MoneyField = "quoted_ex_gst_cents" | "actual_inc_gst_cents";
type StatusField = "approval_status" | "payment_status";

/** A budget row mirrored from a checklist item; its cost facet (budgetItemId) is lazy. */
export interface BudgetRow {
  checklistItemId: string;
  sectionId: string;
  budgetItemId: string | null;
  item: string;
  supplier: string | null;
  quotedExGstCents: number;
  actualIncGstCents: number;
  approval_status: string;
  payment_status: string;
  rfqNo: string | null;
}

/** An imported budget line with no checklist twin (surfaced so nothing is hidden). */
export interface UnlinkedRow {
  budgetItemId: string;
  item: string;
  category: string | null;
  supplier: string | null;
  quotedExGstCents: number;
  actualIncGstCents: number;
  approval_status: string;
  payment_status: string;
  rfqNo: string | null;
}

interface Section {
  id: string;
  name: string;
  sort: number;
}

type Row = BudgetRow & { cid: string; pending?: boolean };

const COLS = 8;

function toLine(r: { quotedExGstCents: number; actualIncGstCents: number; approval_status: string; payment_status: string }): BudgetLine {
  return {
    quotedExGstCents: r.quotedExGstCents,
    actualIncGstCents: r.actualIncGstCents,
    approvalStatus: r.approval_status as BudgetLine["approvalStatus"],
    paymentStatus: r.payment_status as BudgetLine["paymentStatus"],
  };
}

function blankRow(cid: string, sectionId: string): Row {
  return {
    cid,
    pending: true,
    checklistItemId: cid,
    sectionId,
    budgetItemId: null,
    item: "New item",
    supplier: null,
    quotedExGstCents: 0,
    actualIncGstCents: 0,
    approval_status: "pending",
    payment_status: "unpaid",
    rfqNo: null,
  };
}

export function BudgetGrid({
  eventId,
  sections,
  rows: initialRows,
  unlinked: initialUnlinked,
}: {
  eventId: string;
  sections: Section[];
  rows: BudgetRow[];
  unlinked: UnlinkedRow[];
}) {
  const [rows, setRows] = useState<Row[]>(() => initialRows.map((r) => ({ ...r, cid: r.checklistItemId })));
  const [unlinked, setUnlinked] = useState<UnlinkedRow[]>(initialUnlinked);
  const [focusCid, setFocusCid] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const tempCounter = useRef(0);
  const bufferedNames = useRef<Record<string, string>>({});

  // Adopt server re-renders (foreign edits via LiveRefresh, own via revalidatePath):
  // keep each row's stable cid, and keep optimistic rows still awaiting their id.
  useEffect(() => {
    setRows((prev) => {
      const cidByKey = new Map(prev.map((r) => [r.checklistItemId, r.cid]));
      const keys = new Set(initialRows.map((r) => r.checklistItemId));
      const awaitingId = prev.filter((r) => r.pending && !keys.has(r.checklistItemId));
      return [
        ...initialRows.map((r) => ({ ...r, cid: cidByKey.get(r.checklistItemId) ?? r.checklistItemId })),
        ...awaitingId,
      ];
    });
    setUnlinked(initialUnlinked);
  }, [initialRows, initialUnlinked]);

  /** Materialise the linked budget item for a mirror row, caching its id on the row. */
  async function ensureBid(row: Row): Promise<string> {
    if (row.budgetItemId) return row.budgetItemId;
    const { budgetItemId } = await ensureBudgetItem({ eventId, checklistItemId: row.checklistItemId });
    setRows((rs) => rs.map((r) => (r.cid === row.cid ? { ...r, budgetItemId } : r)));
    return budgetItemId;
  }

  function patchRow(cid: string, change: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.cid === cid ? { ...r, ...change } : r)));
  }

  function saveMoney(row: Row, field: MoneyField, cents: number) {
    const prev = rows;
    patchRow(row.cid, field === "quoted_ex_gst_cents" ? { quotedExGstCents: cents } : { actualIncGstCents: cents });
    if (row.pending) return; // wait for the row's real id before persisting
    startTransition(async () => {
      try {
        const bid = await ensureBid(row);
        await updateBudgetMoney({ itemId: bid, eventId, field, cents });
      } catch {
        setRows(prev);
      }
    });
  }

  function saveStatus(row: Row, field: StatusField, value: string) {
    const prev = rows;
    patchRow(row.cid, field === "approval_status" ? { approval_status: value } : { payment_status: value });
    if (row.pending) return;
    startTransition(async () => {
      try {
        const bid = await ensureBid(row);
        await updateBudgetStatus({ itemId: bid, eventId, field, value });
      } catch {
        setRows(prev);
      }
    });
  }

  function saveRfqNo(row: Row, value: string) {
    patchRow(row.cid, { rfqNo: value });
    if (row.pending) return;
    startTransition(async () => {
      try {
        const bid = await ensureBid(row);
        await updateBudgetText({ itemId: bid, eventId, field: "rfq_no", value });
      } catch {
        /* revalidated on next load */
      }
    });
  }

  function renameItem(row: Row, value: string) {
    patchRow(row.cid, { item: value });
    if (row.pending) {
      bufferedNames.current[row.cid] = value;
      return;
    }
    startTransition(async () => {
      try {
        await updateChecklistText({ itemId: row.checklistItemId, eventId, field: "item", value });
      } catch {
        /* revalidated on next load */
      }
    });
  }

  function addItem(sectionId: string) {
    const cid = `tmp-${++tempCounter.current}`;
    setRows((rs) => [...rs, blankRow(cid, sectionId)]);
    setFocusCid(cid);
    startTransition(async () => {
      try {
        const { id } = await addChecklistItem({ eventId, sectionId });
        setRows((rs) =>
          rs
            .filter((r) => !(r.checklistItemId === id && r.cid !== cid)) // a resync may have adopted the server row already
            .map((r) => (r.cid === cid ? { ...r, checklistItemId: id, pending: false } : r)),
        );
        const name = bufferedNames.current[cid];
        delete bufferedNames.current[cid];
        if (name) await updateChecklistText({ itemId: id, eventId, field: "item", value: name });
      } catch {
        setRows((rs) => rs.filter((r) => r.cid !== cid));
        delete bufferedNames.current[cid];
      }
    });
  }

  function removeItem(row: Row) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.cid !== row.cid));
    startTransition(async () => {
      try {
        await removeChecklistItem({ itemId: row.checklistItemId, eventId });
      } catch {
        setRows(prev);
      }
    });
  }

  function raiseRfq(row: Row) {
    startTransition(async () => {
      const bid = await ensureBid(row);
      const { rfqId } = await raiseRfqFromBudget({ eventId, budgetItemId: bid });
      router.push(`/events/${eventId}/rfqs/${rfqId}`);
    });
  }

  // ---- imported / unlinked budget lines (no checklist twin) ----
  function patchUnlinked(id: string, change: Partial<UnlinkedRow>) {
    setUnlinked((us) => us.map((u) => (u.budgetItemId === id ? { ...u, ...change } : u)));
  }
  function saveUnlinkedMoney(id: string, field: MoneyField, cents: number) {
    const prev = unlinked;
    patchUnlinked(id, field === "quoted_ex_gst_cents" ? { quotedExGstCents: cents } : { actualIncGstCents: cents });
    startTransition(() => void updateBudgetMoney({ itemId: id, eventId, field, cents }).catch(() => setUnlinked(prev)));
  }
  function saveUnlinkedStatus(id: string, field: StatusField, value: string) {
    const prev = unlinked;
    patchUnlinked(id, field === "approval_status" ? { approval_status: value } : { payment_status: value });
    startTransition(() => void updateBudgetStatus({ itemId: id, eventId, field, value }).catch(() => setUnlinked(prev)));
  }
  function removeUnlinked(id: string) {
    const prev = unlinked;
    setUnlinked((us) => us.filter((u) => u.budgetItemId !== id));
    startTransition(() => void removeBudgetItemOnly({ eventId, budgetItemId: id }).catch(() => setUnlinked(prev)));
  }

  const grand = rollupBudget([...rows.map(toLine), ...unlinked.map(toLine)]);

  const grouped = sections.map((s) => ({ section: s, items: rows.filter((r) => r.sectionId === s.id) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Quoted ex-GST" value={formatCents(grand.quotedExGstCents)} />
        <Summary label="Quoted inc-GST" value={formatCents(grand.quotedIncGstCents)} />
        <Summary label="Actual inc-GST" value={formatCents(grand.actualIncGstCents)} />
        <Summary
          label="Variance"
          value={formatCents(grand.varianceCents, { showSign: true })}
          tone={grand.varianceCents > 0 ? "danger" : "success"}
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="bg-[var(--muted)]/60 text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <Th className="w-[24%]">Item</Th>
              <Th>Supplier</Th>
              <Th className="text-right">Quoted ex-GST</Th>
              <Th className="text-right">Actual inc-GST</Th>
              <Th>Approval</Th>
              <Th>Payment</Th>
              <Th>RFQ #</Th>
              <th className="w-8"></th>
            </tr>
          </thead>

          {grouped.map((g) => {
            const sub = rollupBudget(g.items.map(toLine));
            return (
              <tbody key={g.section.id}>
                <tr className="bg-[var(--accent)]/40">
                  <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
                    {g.section.name} · {g.items.length}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs font-medium tabular-nums">{formatCents(sub.quotedExGstCents)}</td>
                  <td className="px-3 py-1.5 text-right text-xs font-medium tabular-nums">{formatCents(sub.actualIncGstCents)}</td>
                  <td colSpan={4} className="px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
                    inc-GST {formatCents(sub.quotedIncGstCents)} · var {formatCents(sub.varianceCents, { showSign: true })}
                  </td>
                </tr>
                {g.items.map((r) => (
                  <tr key={r.cid} className={`group border-t align-top hover:bg-[var(--muted)]/40 ${r.pending ? "opacity-60" : ""}`}>
                    <td className="px-2 py-1">
                      <EditableCell value={r.item} autoFocus={r.cid === focusCid} onSave={(v) => renameItem(r, v)} />
                    </td>
                    <td className="px-3 py-1.5 text-[var(--muted-foreground)]">{r.supplier ?? "—"}</td>
                    <td className="px-2 py-1 text-right">
                      <MoneyCell cents={r.quotedExGstCents} onSave={(c) => saveMoney(r, "quoted_ex_gst_cents", c)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <MoneyCell cents={r.actualIncGstCents} onSave={(c) => saveMoney(r, "actual_inc_gst_cents", c)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusButton field="approval_status" value={r.approval_status} onCycle={(n) => saveStatus(r, "approval_status", n)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusButton field="payment_status" value={r.payment_status} onCycle={(n) => saveStatus(r, "payment_status", n)} />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <EditableCell value={r.rfqNo} placeholder="—" onSave={(v) => saveRfqNo(r, v)} />
                        {!r.pending && (
                          <button
                            type="button"
                            onClick={() => raiseRfq(r)}
                            title="Raise an RFQ from this item"
                            className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--muted)]"
                          >
                            RFQ
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(r)}
                        disabled={r.pending}
                        title="Delete item"
                        aria-label={`Delete ${r.item}`}
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
                      onClick={() => addItem(g.section.id)}
                      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add item
                    </button>
                  </td>
                </tr>
              </tbody>
            );
          })}

          {unlinked.length > 0 && (
            <tbody>
              <tr className="bg-[var(--warning)]/10">
                <td colSpan={COLS} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
                  Imported budget lines · not on the checklist · {unlinked.length}
                </td>
              </tr>
              {unlinked.map((u) => (
                <tr key={u.budgetItemId} className="group border-t align-top hover:bg-[var(--muted)]/40">
                  <td className="px-3 py-1.5">{u.item}</td>
                  <td className="px-3 py-1.5 text-[var(--muted-foreground)]">
                    {u.supplier ?? (u.category ? <span className="italic">{u.category}</span> : "—")}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <MoneyCell cents={u.quotedExGstCents} onSave={(c) => saveUnlinkedMoney(u.budgetItemId, "quoted_ex_gst_cents", c)} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <MoneyCell cents={u.actualIncGstCents} onSave={(c) => saveUnlinkedMoney(u.budgetItemId, "actual_inc_gst_cents", c)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusButton field="approval_status" value={u.approval_status} onCycle={(n) => saveUnlinkedStatus(u.budgetItemId, "approval_status", n)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusButton field="payment_status" value={u.payment_status} onCycle={(n) => saveUnlinkedStatus(u.budgetItemId, "payment_status", n)} />
                  </td>
                  <td className="px-3 py-1.5 text-[var(--muted-foreground)]">{u.rfqNo ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeUnlinked(u.budgetItemId)}
                      title="Delete budget line"
                      aria-label={`Delete ${u.item}`}
                      className="rounded p-1 text-[var(--muted-foreground)] opacity-0 transition hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

function MoneyCell({ cents, onSave }: { cents: number; onSave: (cents: number) => void }) {
  const toInput = (c: number) => (c / 100).toFixed(2);
  const [val, setVal] = useState(toInput(cents));
  const committed = useRef(cents);

  useEffect(() => {
    setVal(toInput(cents));
    committed.current = cents;
  }, [cents]);

  function commit() {
    const parsed = dollarsToCents(val) ?? 0;
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
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-28 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-md border bg-[var(--card)] p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</div>
      <div
        className={
          "mt-0.5 text-2xl font-semibold tabular-nums " +
          (tone === "danger" ? "text-[var(--destructive)]" : tone === "success" ? "text-[var(--success)]" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
