"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusButton } from "@/components/status-button";
import { EditableCell } from "@/components/editable-cell";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import { rollupBudget, type BudgetLine } from "@/lib/calc/budget";
import { updateBudgetMoney, updateBudgetStatus, updateBudgetText } from "./actions";
import { raiseRfqFromBudget } from "../rfqs/actions";

export interface BudgetRow {
  id: string;
  categoryId: string;
  item: string;
  supplier: string | null;
  quotedExGstCents: number;
  actualIncGstCents: number;
  approval_status: string;
  payment_status: string;
  rfqNo: string | null;
  notes: string | null;
}

interface Category {
  id: string;
  name: string;
  sort: number;
}

export function BudgetGrid({
  eventId,
  categories,
  rows: initial,
}: {
  eventId: string;
  categories: Category[];
  rows: BudgetRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function patch(id: string, change: Partial<BudgetRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  function raiseRfq(itemId: string) {
    startTransition(async () => {
      const { rfqId } = await raiseRfqFromBudget({ eventId, budgetItemId: itemId });
      router.push(`/events/${eventId}/rfqs/${rfqId}`);
    });
  }

  function saveMoney(id: string, field: "quoted_ex_gst_cents" | "actual_inc_gst_cents", cents: number) {
    const prev = rows;
    patch(id, field === "quoted_ex_gst_cents" ? { quotedExGstCents: cents } : { actualIncGstCents: cents });
    startTransition(async () => {
      try {
        await updateBudgetMoney({ itemId: id, eventId, field, cents });
      } catch {
        setRows(prev);
      }
    });
  }

  function saveStatus(id: string, field: "approval_status" | "payment_status", value: string) {
    const prev = rows;
    patch(id, field === "approval_status" ? { approval_status: value } : { payment_status: value });
    startTransition(async () => {
      try {
        await updateBudgetStatus({ itemId: id, eventId, field, value });
      } catch {
        setRows(prev);
      }
    });
  }

  function saveText(id: string, field: "item" | "notes" | "rfq_no", value: string) {
    patch(id, field === "item" ? { item: value } : field === "notes" ? { notes: value } : { rfqNo: value });
    startTransition(async () => {
      try {
        await updateBudgetText({ itemId: id, eventId, field, value });
      } catch {
        /* revalidated on next load */
      }
    });
  }

  const lines: BudgetLine[] = rows.map((r) => ({
    quotedExGstCents: r.quotedExGstCents,
    actualIncGstCents: r.actualIncGstCents,
    approvalStatus: r.approval_status as BudgetLine["approvalStatus"],
    paymentStatus: r.payment_status as BudgetLine["paymentStatus"],
  }));
  const grand = rollupBudget(lines);

  const groups = categories
    .map((c) => ({ category: c, items: rows.filter((r) => r.categoryId === c.id) }))
    .filter((g) => g.items.length > 0);

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
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              <Th className="w-[26%]">Item</Th>
              <Th>Supplier</Th>
              <Th className="text-right">Quoted ex-GST</Th>
              <Th className="text-right">Actual inc-GST</Th>
              <Th>Approval</Th>
              <Th>Payment</Th>
              <Th>RFQ #</Th>
            </tr>
          </thead>
          {groups.map((g) => {
              const sub = rollupBudget(
                g.items.map((r) => ({
                  quotedExGstCents: r.quotedExGstCents,
                  actualIncGstCents: r.actualIncGstCents,
                  approvalStatus: r.approval_status as BudgetLine["approvalStatus"],
                  paymentStatus: r.payment_status as BudgetLine["paymentStatus"],
                })),
              );
              return (
                <tbody key={g.category.id}>
                  <tr className="bg-[var(--accent)]/40">
                    <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
                      {g.category.name}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-medium">
                      {formatCents(sub.quotedExGstCents)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-medium">
                      {formatCents(sub.actualIncGstCents)}
                    </td>
                    <td colSpan={3} className="px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
                      inc-GST {formatCents(sub.quotedIncGstCents)} · var{" "}
                      {formatCents(sub.varianceCents, { showSign: true })}
                    </td>
                  </tr>
                  {g.items.map((r) => (
                    <tr key={r.id} className="border-t align-top hover:bg-[var(--muted)]/40">
                      <td className="px-2 py-1">
                        <EditableCell value={r.item} onSave={(v) => saveText(r.id, "item", v)} />
                      </td>
                      <td className="px-3 py-1.5 text-[var(--muted-foreground)]">{r.supplier ?? "—"}</td>
                      <td className="px-2 py-1 text-right">
                        <MoneyCell cents={r.quotedExGstCents} onSave={(c) => saveMoney(r.id, "quoted_ex_gst_cents", c)} />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <MoneyCell cents={r.actualIncGstCents} onSave={(c) => saveMoney(r.id, "actual_inc_gst_cents", c)} />
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusButton
                          field="approval_status"
                          value={r.approval_status}
                          onCycle={(n) => saveStatus(r.id, "approval_status", n)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusButton
                          field="payment_status"
                          value={r.payment_status}
                          onCycle={(n) => saveStatus(r.id, "payment_status", n)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <EditableCell value={r.rfqNo} placeholder="—" onSave={(v) => saveText(r.id, "rfq_no", v)} />
                          <button
                            type="button"
                            onClick={() => raiseRfq(r.id)}
                            title="Raise an RFQ from this item"
                            className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--muted)]"
                          >
                            RFQ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
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

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-md border bg-[var(--card)] p-3">
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div
        className={
          "mt-0.5 text-lg font-semibold tabular-nums " +
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
