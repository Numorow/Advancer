"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { EditableCell } from "@/components/editable-cell";
import { addEventContact, removeEventContact, updateEventContact, updateBillingProfile } from "./actions";

type ContactField = "position" | "name" | "company" | "mobile" | "email";
type BillingField = "approver" | "responsible" | "billing_entity" | "abn" | "address" | "notes";

export interface ContactRow {
  id: string;
  position: string | null;
  name: string | null;
  company: string | null;
  mobile: string | null;
  email: string | null;
}

export interface BillingProfile {
  approver: string | null;
  responsible: string | null;
  billing_entity: string | null;
  abn: string | null;
  address: string | null;
  notes: string | null;
}

/** Internal row: `cid` is a stable React key that survives the optimistic→real id swap. */
type Row = ContactRow & { cid: string; pending?: boolean };

const COLS = 6;

const BILLING_FIELDS: { field: BillingField; label: string }[] = [
  { field: "responsible", label: "Responsible" },
  { field: "approver", label: "Approver" },
  { field: "billing_entity", label: "Billing entity" },
  { field: "abn", label: "ABN" },
  { field: "address", label: "Address" },
  { field: "notes", label: "Notes" },
];

export function ContactsView({
  eventId,
  contacts: initial,
  billing,
}: {
  eventId: string;
  contacts: ContactRow[];
  billing: BillingProfile | null;
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((r) => ({ ...r, cid: r.id })));
  const [focusCid, setFocusCid] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const tempCounter = useRef(0);
  // Edits made to a row before its server id arrives, flushed on reconcile.
  const bufferedEdits = useRef<Record<string, Partial<Record<ContactField, string>>>>({});

  function editField(row: Row, field: ContactField, value: string) {
    setRows((rs) => rs.map((r) => (r.cid === row.cid ? { ...r, [field]: value } : r)));
    if (row.pending) {
      bufferedEdits.current[row.cid] = { ...bufferedEdits.current[row.cid], [field]: value };
      return;
    }
    startTransition(async () => {
      try {
        await updateEventContact({ contactId: row.id, eventId, field, value });
      } catch {
        /* server revalidates on next load */
      }
    });
  }

  function addContact() {
    const cid = `tmp-${++tempCounter.current}`;
    setRows((rs) => [
      ...rs,
      { id: cid, cid, pending: true, position: null, name: null, company: null, mobile: null, email: null },
    ]);
    setFocusCid(cid);
    startTransition(async () => {
      try {
        const { id } = await addEventContact({ eventId });
        setRows((rs) => rs.map((r) => (r.cid === cid ? { ...r, id, pending: false } : r)));
        const edits = bufferedEdits.current[cid];
        delete bufferedEdits.current[cid];
        if (edits) {
          for (const [field, value] of Object.entries(edits)) {
            await updateEventContact({ contactId: id, eventId, field: field as ContactField, value });
          }
        }
      } catch {
        setRows((rs) => rs.filter((r) => r.cid !== cid));
        delete bufferedEdits.current[cid];
      }
    });
  }

  function removeContact(row: Row) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.cid !== row.cid));
    startTransition(async () => {
      try {
        await removeEventContact({ contactId: row.id, eventId });
      } catch {
        setRows(prev);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              <Th className="w-[24%]">Position / role</Th>
              <Th className="w-[20%]">Name</Th>
              <Th className="w-[20%]">Company</Th>
              <Th>Mobile</Th>
              <Th>Email</Th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.cid}
                className={`group border-t align-top hover:bg-[var(--muted)]/40 ${r.pending ? "opacity-60" : ""}`}
              >
                <td className="px-2 py-1">
                  <EditableCell
                    value={r.position}
                    placeholder="Role"
                    autoFocus={r.cid === focusCid}
                    onSave={(v) => editField(r, "position", v)}
                  />
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.name} placeholder="—" onSave={(v) => editField(r, "name", v)} />
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.company} placeholder="—" onSave={(v) => editField(r, "company", v)} />
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.mobile} placeholder="—" onSave={(v) => editField(r, "mobile", v)} />
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.email} placeholder="—" onSave={(v) => editField(r, "email", v)} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => removeContact(r)}
                    disabled={r.pending}
                    title="Delete contact"
                    aria-label={`Delete ${r.name ?? "contact"}`}
                    className="rounded p-1 text-[var(--muted-foreground)] opacity-0 transition hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                  No contacts yet.
                </td>
              </tr>
            )}
            <tr className="border-t">
              <td colSpan={COLS} className="px-2 py-1">
                <button
                  type="button"
                  onClick={addContact}
                  className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add contact
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <BillingCard eventId={eventId} billing={billing} />
    </div>
  );
}

function BillingCard({ eventId, billing }: { eventId: string; billing: BillingProfile | null }) {
  const [, startTransition] = useTransition();

  function save(field: BillingField, value: string) {
    startTransition(async () => {
      try {
        await updateBillingProfile({ eventId, field, value });
      } catch {
        /* server revalidates on next load */
      }
    });
  }

  return (
    <section className="rounded-md border">
      <div className="border-b bg-[var(--muted)] px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Billing details
        </h2>
      </div>
      <dl className="grid gap-x-6 gap-y-2 p-3 sm:grid-cols-2">
        {BILLING_FIELDS.map(({ field, label }) => (
          <div key={field} className="flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-xs text-[var(--muted-foreground)]">{label}</dt>
            <dd className="min-w-0 flex-1">
              <EditableCell
                value={billing?.[field] ?? null}
                placeholder="—"
                onSave={(v) => save(field, v)}
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
