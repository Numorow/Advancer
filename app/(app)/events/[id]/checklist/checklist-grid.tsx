"use client";

import { useState, useTransition } from "react";
import { StatusButton } from "@/components/status-button";
import { EditableCell } from "@/components/editable-cell";
import { updateChecklistStatus, updateChecklistText } from "./actions";

type ChecklistStatusField = "rfq_status" | "booking_status" | "payment_status" | "status";

export interface ChecklistRow {
  id: string;
  sectionId: string;
  item: string;
  details: string | null;
  responsible: string | null;
  supplier: string | null;
  rfq_status: string;
  booking_status: string;
  payment_status: string;
  status: string;
}

interface Section {
  id: string;
  name: string;
  sort: number;
}

export function ChecklistGrid({
  eventId,
  sections,
  rows: initial,
}: {
  eventId: string;
  sections: Section[];
  rows: ChecklistRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("");
  const [, startTransition] = useTransition();

  function cycle(id: string, field: ChecklistStatusField, next: string) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: next } : r)));
    startTransition(async () => {
      try {
        await updateChecklistStatus({ itemId: id, eventId, field, value: next });
      } catch {
        setRows(prev);
      }
    });
  }

  function editText(id: string, field: "item" | "details" | "responsible", value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    startTransition(async () => {
      try {
        await updateChecklistText({ itemId: id, eventId, field, value });
      } catch {
        /* server revalidates on next load */
      }
    });
  }

  const q = filter.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) =>
        `${r.item} ${r.details ?? ""} ${r.supplier ?? ""} ${r.responsible ?? ""}`
          .toLowerCase()
          .includes(q),
      )
    : rows;

  const grouped = sections
    .map((s) => ({ section: s, items: visible.filter((r) => r.sectionId === s.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-3">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter ${rows.length} items…`}
        className="h-9 w-full max-w-xs rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              <Th className="w-[24%]">Item</Th>
              <Th className="w-[24%]">Details</Th>
              <Th>Supplier</Th>
              <Th>Responsible</Th>
              <Th>RFQ</Th>
              <Th>Booking</Th>
              <Th>Payment</Th>
              <Th>Progress</Th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <GroupRows
                key={g.section.id}
                name={g.section.name}
                items={g.items}
                onCycle={cycle}
                onEdit={editText}
              />
            ))}
            {grouped.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                  No matching items.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  name,
  items,
  onCycle,
  onEdit,
}: {
  name: string;
  items: ChecklistRow[];
  onCycle: (id: string, field: ChecklistStatusField, next: string) => void;
  onEdit: (id: string, field: "item" | "details" | "responsible", value: string) => void;
}) {
  return (
    <>
      <tr className="bg-[var(--accent)]/40">
        <td
          colSpan={8}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]"
        >
          {name} · {items.length}
        </td>
      </tr>
      {items.map((r) => (
        <tr key={r.id} className="border-t align-top hover:bg-[var(--muted)]/40">
          <td className="px-2 py-1">
            <EditableCell value={r.item} onSave={(v) => onEdit(r.id, "item", v)} />
          </td>
          <td className="px-2 py-1">
            <EditableCell
              value={r.details}
              placeholder="—"
              onSave={(v) => onEdit(r.id, "details", v)}
            />
          </td>
          <td className="px-3 py-1.5 text-[var(--muted-foreground)]">{r.supplier ?? "—"}</td>
          <td className="px-2 py-1">
            <EditableCell
              value={r.responsible}
              placeholder="—"
              onSave={(v) => onEdit(r.id, "responsible", v)}
            />
          </td>
          <td className="px-3 py-1.5">
            <StatusButton field="rfq_status" value={r.rfq_status} onCycle={(n) => onCycle(r.id, "rfq_status", n)} />
          </td>
          <td className="px-3 py-1.5">
            <StatusButton
              field="booking_status"
              value={r.booking_status}
              onCycle={(n) => onCycle(r.id, "booking_status", n)}
            />
          </td>
          <td className="px-3 py-1.5">
            <StatusButton
              field="payment_status"
              value={r.payment_status}
              onCycle={(n) => onCycle(r.id, "payment_status", n)}
            />
          </td>
          <td className="px-3 py-1.5">
            <StatusButton field="status" value={r.status} onCycle={(n) => onCycle(r.id, "status", n)} />
          </td>
        </tr>
      ))}
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
