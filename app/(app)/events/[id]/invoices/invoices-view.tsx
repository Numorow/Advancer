"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { EditableCell } from "@/components/editable-cell";
import { StatusButton } from "@/components/status-button";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import { invoicesRollup } from "@/lib/calc/invoices";
import { addInvoice, removeInvoice, setInvoiceFile, updateInvoiceField } from "./actions";

export interface SupplierOpt {
  id: string;
  name: string;
}
export interface BudgetLineOpt {
  id: string;
  label: string;
}

export interface InvoiceRow {
  id: string;
  kind: string; // 'quote' | 'invoice'
  budgetItemId: string | null;
  budgetLabel: string | null;
  supplierId: string | null;
  supplierName: string | null;
  reference: string | null;
  issuedDate: string | null;
  dueDate: string | null;
  amountIncGstCents: number | null;
  status: string;
  filePath: string | null;
  fileUrl: string | null;
  externalUrl: string | null;
  notes: string | null;
}

type RawValue = string | number | boolean | null;

export function InvoicesView({
  eventId,
  invoices: initial,
  suppliers,
  budgetLines,
}: {
  eventId: string;
  invoices: InvoiceRow[];
  suppliers: SupplierOpt[];
  budgetLines: BudgetLineOpt[];
}) {
  const [rows, setRows] = useState(initial);
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => setRows(initial), [initial]);

  const supplierName = (id: string | null) => (id ? suppliers.find((s) => s.id === id)?.name ?? null : null);
  const budgetLabel = (id: string | null) => (id ? budgetLines.find((b) => b.id === id)?.label ?? null : null);

  function edit(id: string, camel: keyof InvoiceRow, snake: string, value: RawValue, extra?: Partial<InvoiceRow>) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [camel]: value, ...extra } : r)));
    startTransition(() =>
      void updateInvoiceField({ eventId, invoiceId: id, field: snake, value }).catch(() => setRows(prev)),
    );
  }

  function onAdd(kind: "quote" | "invoice") {
    startTransition(async () => {
      const { id } = await addInvoice({ eventId, kind });
      setRows((rs) =>
        rs.some((r) => r.id === id)
          ? rs
          : [
              ...rs,
              {
                id,
                kind,
                budgetItemId: null,
                budgetLabel: null,
                supplierId: null,
                supplierName: null,
                reference: null,
                issuedDate: null,
                dueDate: null,
                amountIncGstCents: null,
                status: "received",
                filePath: null,
                fileUrl: null,
                externalUrl: null,
                notes: null,
              },
            ],
      );
    });
  }

  function onRemove(id: string) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(() => void removeInvoice({ eventId, invoiceId: id }).catch(() => setRows(prev)));
  }

  function onUpload(id: string, file: File) {
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("invoiceId", id);
    fd.set("file", file);
    startTransition(async () => {
      const res = await setInvoiceFile(fd);
      if (res.error) alert(res.error);
      router.refresh();
    });
  }

  const roll = invoicesRollup(
    rows.map((r) => ({ kind: r.kind, amount_inc_gst_cents: r.amountIncGstCents, status: r.status })),
  );

  const visible = rows.filter(
    (r) =>
      (!kindFilter || r.kind === kindFilter) &&
      (!statusFilter || r.status === statusFilter) &&
      (!supplierFilter || r.supplierId === supplierFilter),
  );

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Invoiced (inc GST)" value={formatCents(roll.invoicedIncGstCents)} />
        <Tile label="Paid (inc GST)" value={formatCents(roll.paidIncGstCents)} tone="success" />
        <Tile
          label="Outstanding to pay"
          value={formatCents(roll.outstandingIncGstCents)}
          tone={roll.outstandingIncGstCents > 0 ? "danger" : "success"}
        />
        <Tile label="Quotes on file" value={String(roll.quoteCount)} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm">
          <option value="">All kinds</option>
          <option value="invoice">Invoices</option>
          <option value="quote">Quotes</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm">
          <option value="">All statuses</option>
          {["received", "approved", "paid", "accepted", "rejected"].map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm">
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => onAdd("invoice")} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-[var(--muted)]">
            <Plus className="h-3.5 w-3.5" /> Invoice
          </button>
          <button type="button" onClick={() => onAdd("quote")} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-[var(--muted)]">
            <Plus className="h-3.5 w-3.5" /> Quote
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1280px] border-collapse text-sm">
          <thead className="bg-[var(--muted)]/60 text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              {["Kind", "Supplier", "Budget line", "Reference", "Issued", "Due", "Amount inc-GST", "Status", "File", "Notes", ""].map((h, i) => (
                <th key={i} className="px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="group border-t align-top hover:bg-[var(--muted)]/40">
                <td className="px-2 py-1">
                  <select
                    value={r.kind}
                    onChange={(e) => edit(r.id, "kind", "kind", e.target.value, { status: "received" })}
                    className="cursor-pointer rounded bg-transparent py-1 text-sm capitalize outline-none focus:bg-[var(--muted)]"
                  >
                    <option value="invoice">Invoice</option>
                    <option value="quote">Quote</option>
                  </select>
                </td>
                <td className="px-2 py-1 min-w-[150px]">
                  <PickerSelect
                    value={r.supplierId}
                    fallback={r.supplierName}
                    options={suppliers.map((s) => ({ id: s.id, label: s.name }))}
                    onChange={(v) => edit(r.id, "supplierId", "supplier_id", v, { supplierName: supplierName(v) })}
                  />
                </td>
                <td className="px-2 py-1 min-w-[170px]">
                  <PickerSelect
                    value={r.budgetItemId}
                    fallback={r.budgetLabel}
                    options={budgetLines}
                    onChange={(v) => edit(r.id, "budgetItemId", "budget_item_id", v, { budgetLabel: budgetLabel(v) })}
                  />
                </td>
                <td className="px-2 py-1 min-w-[120px]">
                  <EditableCell value={r.reference} placeholder="—" onSave={(v) => edit(r.id, "reference", "reference", v)} />
                </td>
                <td className="px-2 py-1">
                  <input type="date" value={r.issuedDate ?? ""} onChange={(e) => edit(r.id, "issuedDate", "issued_date", e.target.value || null)} className="h-8 rounded bg-transparent px-1 text-xs outline-none focus:bg-[var(--muted)]" />
                </td>
                <td className="px-2 py-1">
                  <input type="date" value={r.dueDate ?? ""} onChange={(e) => edit(r.id, "dueDate", "due_date", e.target.value || null)} className="h-8 rounded bg-transparent px-1 text-xs outline-none focus:bg-[var(--muted)]" />
                </td>
                <td className="px-2 py-1 text-right">
                  <MoneyCell cents={r.amountIncGstCents ?? 0} onSave={(c) => edit(r.id, "amountIncGstCents", "amount_inc_gst_cents", c)} />
                </td>
                <td className="px-2 py-1">
                  <StatusButton
                    field={r.kind === "invoice" ? "invoice_status" : "quote_status"}
                    value={r.status}
                    onCycle={(n) => edit(r.id, "status", "status", n)}
                  />
                </td>
                <td className="px-2 py-1 min-w-[150px]">
                  <FileCell row={r} onUpload={(f) => onUpload(r.id, f)} onSaveUrl={(v) => edit(r.id, "externalUrl", "external_url", v)} />
                </td>
                <td className="px-2 py-1 min-w-[140px]">
                  <EditableCell value={r.notes} placeholder="—" onSave={(v) => edit(r.id, "notes", "notes", v)} />
                </td>
                <td className="px-2 py-1 text-right">
                  <RemoveButton label={r.reference ?? r.kind} onClick={() => onRemove(r.id)} />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-[var(--muted-foreground)]">
                  {rows.length === 0 ? "No quotes or invoices yet." : "No records match the filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- helpers */

function Tile({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-md border bg-[var(--card)] p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</div>
      <div
        className={
          "mt-0.5 text-xl font-semibold tabular-nums " +
          (tone === "danger" ? "text-[var(--destructive)]" : tone === "success" ? "text-[var(--success)]" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function PickerSelect({
  value,
  fallback,
  options,
  onChange,
}: {
  value: string | null;
  fallback: string | null;
  options: { id: string; label: string }[];
  onChange: (id: string | null) => void;
}) {
  const inList = value != null && options.some((o) => o.id === value);
  return (
    <select
      value={inList ? value : ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={`w-full cursor-pointer rounded bg-transparent py-1 text-sm outline-none focus:bg-[var(--muted)] ${inList ? "" : "text-[var(--muted-foreground)]"}`}
    >
      <option value="">{(!inList && fallback) || "—"}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FileCell({ row, onUpload, onSaveUrl }: { row: InvoiceRow; onUpload: (f: File) => void; onSaveUrl: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (row.fileUrl) {
    return (
      <a href={row.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline">
        <Paperclip className="h-3.5 w-3.5" /> View file
      </a>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <EditableCell value={row.externalUrl} placeholder="paste a link…" onSave={onSaveUrl} />
      <button type="button" onClick={() => inputRef.current?.click()} title="Upload a file" className="shrink-0 rounded border p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
        <Upload className="h-3.5 w-3.5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
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
      className="w-24 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Delete"
      aria-label={`Delete ${label}`}
      className="rounded p-1 text-[var(--muted-foreground)] opacity-0 transition hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
