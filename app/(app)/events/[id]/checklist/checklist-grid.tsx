"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { StatusButton } from "@/components/status-button";
import { EditableCell } from "@/components/editable-cell";
import {
  addChecklistItem,
  removeChecklistItem,
  updateChecklistStatus,
  updateChecklistText,
} from "./actions";
import { raiseRfqFromChecklist } from "../rfqs/actions";

type ChecklistStatusField = "rfq_status" | "booking_status" | "payment_status" | "status";
type TextField = "item" | "details" | "responsible";

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

/** Internal row: `cid` is a stable React key that survives the optimistic→real id swap. */
type Row = ChecklistRow & { cid: string; pending?: boolean };

interface Section {
  id: string;
  name: string;
  sort: number;
}

const COLS = 9;

function blankRow(cid: string, sectionId: string): Row {
  return {
    id: cid,
    cid,
    sectionId,
    pending: true,
    item: "New item",
    details: null,
    responsible: null,
    supplier: null,
    rfq_status: "not_sent",
    booking_status: "not_booked",
    payment_status: "unpaid",
    status: "not_started",
  };
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
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => initial.map((r) => ({ ...r, cid: r.id })));
  const [filter, setFilter] = useState("");
  const [focusCid, setFocusCid] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const tempCounter = useRef(0);
  // Edits made to a row before its server id arrives, flushed on reconcile.
  const bufferedEdits = useRef<Record<string, Partial<Record<TextField, string>>>>({});

  function cycle(row: Row, field: ChecklistStatusField, next: string) {
    setRows((rs) => rs.map((r) => (r.cid === row.cid ? { ...r, [field]: next } : r)));
    if (row.pending) return; // status of a not-yet-saved row stays local until it exists
    const prev = rows;
    startTransition(async () => {
      try {
        await updateChecklistStatus({ itemId: row.id, eventId, field, value: next });
      } catch {
        setRows(prev);
      }
    });
  }

  function editText(row: Row, field: TextField, value: string) {
    setRows((rs) => rs.map((r) => (r.cid === row.cid ? { ...r, [field]: value } : r)));
    if (row.pending) {
      bufferedEdits.current[row.cid] = { ...bufferedEdits.current[row.cid], [field]: value };
      return;
    }
    startTransition(async () => {
      try {
        await updateChecklistText({ itemId: row.id, eventId, field, value });
      } catch {
        /* server revalidates on next load */
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
        setRows((rs) => rs.map((r) => (r.cid === cid ? { ...r, id, pending: false } : r)));
        const edits = bufferedEdits.current[cid];
        delete bufferedEdits.current[cid];
        if (edits) {
          for (const [field, value] of Object.entries(edits)) {
            await updateChecklistText({ itemId: id, eventId, field: field as TextField, value });
          }
        }
      } catch {
        setRows((rs) => rs.filter((r) => r.cid !== cid)); // roll back the optimistic row
        delete bufferedEdits.current[cid];
      }
    });
  }

  function removeItem(row: Row) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.cid !== row.cid));
    startTransition(async () => {
      try {
        await removeChecklistItem({ itemId: row.id, eventId });
      } catch {
        setRows(prev);
      }
    });
  }

  function raiseRfq(row: Row) {
    if (row.pending) return;
    startTransition(async () => {
      try {
        const { rfqId } = await raiseRfqFromChecklist({ eventId, checklistItemId: row.id });
        router.push(`/events/${eventId}/rfqs/${rfqId}`);
      } catch {
        /* surfaced on next load */
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

  // Unfiltered: show every section (even empty) so you can always add.
  // Filtered: only sections with matching items.
  const grouped = sections
    .map((s) => ({ section: s, items: visible.filter((r) => r.sectionId === s.id) }))
    .filter((g) => !q || g.items.length > 0);

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
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <GroupRows
                key={g.section.id}
                section={g.section}
                items={g.items}
                focusCid={focusCid}
                canAdd={!q}
                onCycle={cycle}
                onEdit={editText}
                onAdd={addItem}
                onRemove={removeItem}
                onRaiseRfq={raiseRfq}
              />
            ))}
            {grouped.length === 0 && (
              <tr>
                <td colSpan={COLS} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                  {q ? "No matching items." : "No checklist sections yet."}
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
  section,
  items,
  focusCid,
  canAdd,
  onCycle,
  onEdit,
  onAdd,
  onRemove,
  onRaiseRfq,
}: {
  section: Section;
  items: Row[];
  focusCid: string | null;
  canAdd: boolean;
  onCycle: (row: Row, field: ChecklistStatusField, next: string) => void;
  onEdit: (row: Row, field: TextField, value: string) => void;
  onAdd: (sectionId: string) => void;
  onRemove: (row: Row) => void;
  onRaiseRfq: (row: Row) => void;
}) {
  return (
    <>
      <tr className="bg-[var(--accent)]/40">
        <td
          colSpan={COLS}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-foreground)]"
        >
          {section.name} · {items.length}
        </td>
      </tr>
      {items.map((r) => (
        <tr
          key={r.cid}
          className={`group border-t align-top hover:bg-[var(--muted)]/40 ${r.pending ? "opacity-60" : ""}`}
        >
          <td className="px-2 py-1">
            <EditableCell
              value={r.item}
              autoFocus={r.cid === focusCid}
              onSave={(v) => onEdit(r, "item", v)}
            />
          </td>
          <td className="px-2 py-1">
            <EditableCell value={r.details} placeholder="—" onSave={(v) => onEdit(r, "details", v)} />
          </td>
          <td className="px-3 py-1.5 text-[var(--muted-foreground)]">{r.supplier ?? "—"}</td>
          <td className="px-2 py-1">
            <EditableCell
              value={r.responsible}
              placeholder="—"
              onSave={(v) => onEdit(r, "responsible", v)}
            />
          </td>
          <td className="px-3 py-1.5">
            <div className="flex items-center gap-1">
              <StatusButton field="rfq_status" value={r.rfq_status} onCycle={(n) => onCycle(r, "rfq_status", n)} />
              {!r.pending && (
                <button
                  type="button"
                  onClick={() => onRaiseRfq(r)}
                  title="Raise an RFQ from this item"
                  className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] opacity-0 transition hover:bg-[var(--muted)] focus:opacity-100 group-hover:opacity-100"
                >
                  RFQ
                </button>
              )}
            </div>
          </td>
          <td className="px-3 py-1.5">
            <StatusButton field="booking_status" value={r.booking_status} onCycle={(n) => onCycle(r, "booking_status", n)} />
          </td>
          <td className="px-3 py-1.5">
            <StatusButton field="payment_status" value={r.payment_status} onCycle={(n) => onCycle(r, "payment_status", n)} />
          </td>
          <td className="px-3 py-1.5">
            <StatusButton field="status" value={r.status} onCycle={(n) => onCycle(r, "status", n)} />
          </td>
          <td className="px-2 py-1.5 text-right">
            <button
              type="button"
              onClick={() => onRemove(r)}
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
      {canAdd && (
        <tr className="border-t">
          <td colSpan={COLS} className="px-2 py-1">
            <button
              type="button"
              onClick={() => onAdd(section.id)}
              className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add item
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
