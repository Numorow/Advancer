"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditableCell } from "@/components/editable-cell";
import { StatusButton } from "@/components/status-button";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import { compareQuotes, isBestQuote, compareLineQuotes } from "@/lib/calc/rfq";
import { buildRfqEmail } from "@/lib/rfq/document";
import {
  updateRfqField,
  updateRfqStatus,
  addRfqItem,
  updateRfqItem,
  removeRfqItem,
  addRecipient,
  updateRecipientStatus,
  updateRecipientQuote,
  removeRecipient,
  markAllRecipientsSent,
  upsertRfqQuote,
  addRfqAttachment,
  removeRfqAttachment,
  awardRfq,
} from "../actions";

interface Header {
  id: string;
  rfqNo: string | null;
  title: string;
  status: string;
  location: string | null;
  notes: string | null;
  deliveryDate: string | null;
  collectionDate: string | null;
  responseDueDate: string | null;
  awardedRecipientId: string | null;
}
interface Item {
  id: string;
  description: string;
  quantity: string | null;
  unit: string | null;
}
interface Recipient {
  id: string;
  supplierId: string | null;
  supplierName: string;
  supplierEmail: string | null;
  supplierContactName: string | null;
  status: string;
  quotedExGstCents: number | null;
  quoteLink: string | null;
}
interface SupplierOpt {
  id: string;
  name: string;
}
interface LineQuote {
  recipientId: string;
  itemId: string;
  lineTotalCents: number | null;
}
interface RfqAttachment {
  id: string;
  recipientId: string;
  label: string;
  url: string | null;
}

export function RfqEditor({
  eventId,
  orgName,
  eventName,
  rfq,
  items: initialItems,
  recipients: initialRecipients,
  suppliers,
  lineQuotes,
  attachments,
}: {
  eventId: string;
  orgName: string;
  eventName: string;
  rfq: Header;
  items: Item[];
  recipients: Recipient[];
  suppliers: SupplierOpt[];
  lineQuotes: LineQuote[];
  attachments: RfqAttachment[];
}) {
  const router = useRouter();
  const [header, setHeader] = useState(rfq);
  const [items, setItems] = useState(initialItems);
  const [recipients, setRecipients] = useState(initialRecipients);
  const [newItem, setNewItem] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Map<string, number | null>>(
    () => new Map(lineQuotes.map((q) => [`${q.recipientId}:${q.itemId}`, q.lineTotalCents])),
  );
  const [, startTransition] = useTransition();

  const cmp = compareQuotes(recipients.map((r) => ({ id: r.id, quotedExGstCents: r.quotedExGstCents })));
  const rfqId = header.id;

  /* header */
  function saveField(field: "title" | "location" | "notes" | "rfq_no", value: string) {
    setHeader((h) => ({ ...h, [field === "rfq_no" ? "rfqNo" : field]: value }));
    startTransition(() => void updateRfqField({ rfqId, eventId, field, value }).catch(() => {}));
  }
  function saveDate(field: "delivery_date" | "collection_date" | "response_due_date", value: string) {
    const key =
      field === "delivery_date" ? "deliveryDate" : field === "collection_date" ? "collectionDate" : "responseDueDate";
    setHeader((h) => ({ ...h, [key]: value || null }));
    startTransition(() => void updateRfqField({ rfqId, eventId, field, value: value || null }).catch(() => {}));
  }
  function cycleStatus(next: string) {
    setHeader((h) => ({ ...h, status: next }));
    startTransition(() => void updateRfqStatus({ rfqId, eventId, value: next }).catch(() => {}));
  }

  /* items */
  function onAddItem(e: React.FormEvent) {
    e.preventDefault();
    const description = newItem.trim();
    if (!description) return;
    setNewItem("");
    startTransition(async () => {
      const { id } = await addRfqItem({ rfqId, eventId, description });
      setItems((xs) => [...xs, { id, description, quantity: null, unit: null }]);
    });
  }
  function saveItem(itemId: string, field: "description" | "quantity" | "unit", value: string) {
    setItems((xs) => xs.map((x) => (x.id === itemId ? { ...x, [field]: value } : x)));
    startTransition(() => void updateRfqItem({ itemId, rfqId, eventId, field, value }).catch(() => {}));
  }
  function deleteItem(itemId: string) {
    setItems((xs) => xs.filter((x) => x.id !== itemId));
    startTransition(() => void removeRfqItem({ itemId, rfqId, eventId }).catch(() => {}));
  }

  /* recipients */
  function onAddRecipient(e: React.FormEvent) {
    e.preventDefault();
    if (!newSupplier) return;
    const supplier = suppliers.find((s) => s.id === newSupplier);
    setNewSupplier("");
    startTransition(async () => {
      const { id } = await addRecipient({ rfqId, eventId, supplierId: supplier!.id });
      setRecipients((xs) => [
        ...xs,
        {
          id,
          supplierId: supplier!.id,
          supplierName: supplier!.name,
          supplierEmail: null,
          supplierContactName: null,
          status: "pending",
          quotedExGstCents: null,
          quoteLink: null,
        },
      ]);
    });
  }
  function cycleRecipient(recipientId: string, next: string) {
    setRecipients((xs) => xs.map((x) => (x.id === recipientId ? { ...x, status: next } : x)));
    startTransition(() => void updateRecipientStatus({ recipientId, rfqId, eventId, value: next }).catch(() => {}));
  }
  function saveQuote(recipientId: string, cents: number | null) {
    setRecipients((xs) =>
      xs.map((x) =>
        x.id === recipientId
          ? { ...x, quotedExGstCents: cents, status: cents != null ? "responded" : x.status }
          : x,
      ),
    );
    startTransition(() => void updateRecipientQuote({ recipientId, rfqId, eventId, cents }).catch(() => {}));
  }
  function deleteRecipient(recipientId: string) {
    setRecipients((xs) => xs.filter((x) => x.id !== recipientId));
    startTransition(() => void removeRecipient({ recipientId, rfqId, eventId }).catch(() => {}));
  }
  function onAward(recipientId: string) {
    setHeader((h) => ({ ...h, status: "awarded", awardedRecipientId: recipientId }));
    startTransition(async () => {
      await awardRfq({ rfqId, eventId, recipientId }).catch(() => {});
      router.refresh();
    });
  }

  /* email-ready RFQ */
  function emailFor(r: Recipient) {
    return buildRfqEmail({
      rfq: {
        rfqNo: header.rfqNo,
        title: header.title,
        deliveryDate: header.deliveryDate,
        collectionDate: header.collectionDate,
        responseDueDate: header.responseDueDate,
        location: header.location,
        notes: header.notes,
      },
      items: items.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit })),
      recipient: { supplierName: r.supplierName, contactName: r.supplierContactName },
      orgName,
      eventName,
    });
  }
  function onEmail(r: Recipient) {
    const { subject, body } = emailFor(r);
    window.location.href = `mailto:${encodeURIComponent(r.supplierEmail ?? "")}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }
  function onCopyEmail(r: Recipient) {
    const { subject, body } = emailFor(r);
    void navigator.clipboard
      ?.writeText(`Subject: ${subject}\n\n${body}`)
      .then(() => {
        setCopiedId(r.id);
        setTimeout(() => setCopiedId((c) => (c === r.id ? null : c)), 1500);
      })
      .catch(() => {});
  }
  function onMarkAllSent() {
    setRecipients((xs) => xs.map((x) => (x.status === "pending" ? { ...x, status: "sent" } : x)));
    startTransition(() => void markAllRecipientsSent({ rfqId, eventId }).catch(() => {}));
  }

  /* itemised line quotes */
  function saveLineQuote(recipientId: string, itemId: string, cents: number | null) {
    setQuotes((m) => {
      const next = new Map(m);
      next.set(`${recipientId}:${itemId}`, cents);
      return next;
    });
    startTransition(() => {
      void upsertRfqQuote({ recipientId, itemId, rfqId, eventId, lineTotalCents: cents })
        .then((res) => {
          // Reflect the recomputed lump total back onto the recipient row.
          if (res && res.recipientTotalCents !== null) {
            setRecipients((xs) =>
              xs.map((x) => (x.id === recipientId ? { ...x, quotedExGstCents: res.recipientTotalCents } : x)),
            );
          }
        })
        .catch(() => {});
    });
  }

  const usedSupplierIds = new Set(recipients.map((r) => r.supplierId));
  const availableSuppliers = suppliers.filter((s) => !usedSupplierIds.has(s.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>
              <span className="font-mono text-sm text-[var(--muted-foreground)]">{header.rfqNo ?? "RFQ"}</span> ·{" "}
              {header.title}
            </CardTitle>
            <StatusButton field="rfq_workflow" value={header.status} onCycle={cycleStatus} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Title">
            <Input value={header.title} onSave={(v) => saveField("title", v)} />
          </Labeled>
          <Labeled label="RFQ #">
            <Input value={header.rfqNo ?? ""} onSave={(v) => saveField("rfq_no", v)} />
          </Labeled>
          <Labeled label="Delivery date">
            <DateInput value={header.deliveryDate} onSave={(v) => saveDate("delivery_date", v)} />
          </Labeled>
          <Labeled label="Collection date">
            <DateInput value={header.collectionDate} onSave={(v) => saveDate("collection_date", v)} />
          </Labeled>
          <Labeled label="Quote due">
            <DateInput value={header.responseDueDate} onSave={(v) => saveDate("response_due_date", v)} />
          </Labeled>
          <Labeled label="Location">
            <Input value={header.location ?? ""} onSave={(v) => saveField("location", v)} />
          </Labeled>
          <Labeled label="Notes">
            <Input value={header.notes ?? ""} onSave={(v) => saveField("notes", v)} />
          </Labeled>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 border-b pb-1.5">
              <div className="min-w-0 flex-1">
                <EditableCell value={it.description} onSave={(v) => saveItem(it.id, "description", v)} />
              </div>
              <div className="w-20">
                <EditableCell value={it.quantity} placeholder="qty" onSave={(v) => saveItem(it.id, "quantity", v)} />
              </div>
              <div className="w-20">
                <EditableCell value={it.unit} placeholder="unit" onSave={(v) => saveItem(it.id, "unit", v)} />
              </div>
              <button
                type="button"
                onClick={() => deleteItem(it.id)}
                className="shrink-0 text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
              >
                remove
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No items yet.</p>}
          <form onSubmit={onAddItem} className="flex items-center gap-2 pt-1">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add item description"
              className="h-9 flex-1 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <Button type="submit" size="sm" variant="outline">
              Add item
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Recipients &amp; quotes ({recipients.length})</CardTitle>
            <div className="flex items-center gap-2">
              {cmp.bestCents != null && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  Best {formatCents(cmp.bestCents)}
                  {cmp.spreadCents ? ` · spread ${formatCents(cmp.spreadCents)}` : ""}
                </span>
              )}
              <a
                href={`/events/${eventId}/rfqs/${rfqId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-[var(--muted)]"
              >
                Download PDF
              </a>
              {recipients.some((r) => r.status === "pending") && (
                <Button size="sm" variant="outline" onClick={onMarkAllSent}>
                  Mark all sent
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="text-left text-xs text-[var(--muted-foreground)]">
                <tr>
                  <th className="py-1 font-medium">Supplier</th>
                  <th className="py-1 font-medium">Status</th>
                  <th className="py-1 text-right font-medium">Quote ex-GST</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => {
                  const best = isBestQuote(r.id, cmp);
                  const awarded = header.awardedRecipientId === r.id;
                  return (
                    <tr key={r.id} className={`border-t ${awarded ? "bg-green-50/60" : ""}`}>
                      <td className="py-1.5">
                        {r.supplierName}
                        {best && (
                          <Badge tone="success" className="ml-2">
                            best
                          </Badge>
                        )}
                        {awarded && (
                          <Badge tone="info" className="ml-1">
                            awarded
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5">
                        <StatusButton field="rfq_recipient" value={r.status} onCycle={(n) => cycleRecipient(r.id, n)} />
                      </td>
                      <td className="py-1.5 text-right">
                        <MoneyInput cents={r.quotedExGstCents} onSave={(c) => saveQuote(r.id, c)} />
                      </td>
                      <td className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onEmail(r)}
                            title={r.supplierEmail ? `Email ${r.supplierEmail}` : "No email on file — opens a blank draft"}
                            className="text-xs text-[var(--primary)] hover:underline"
                          >
                            Email
                          </button>
                          <button
                            type="button"
                            onClick={() => onCopyEmail(r)}
                            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            {copiedId === r.id ? "Copied" : "Copy"}
                          </button>
                          <a
                            href={`/events/${eventId}/rfqs/${rfqId}/pdf?recipient=${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            PDF
                          </a>
                          <Button
                            size="sm"
                            variant={awarded ? "secondary" : "default"}
                            disabled={awarded}
                            onClick={() => onAward(r.id)}
                          >
                            {awarded ? "Awarded" : "Award"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => deleteRecipient(r.id)}
                            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                          >
                            remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {recipients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[var(--muted-foreground)]">
                      No recipients yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {availableSuppliers.length > 0 && (
            <form onSubmit={onAddRecipient} className="flex items-center gap-2">
              <select
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm"
              >
                <option value="">Add a supplier…</option>
                {availableSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="outline" disabled={!newSupplier}>
                Add recipient
              </Button>
            </form>
          )}
          <p className="text-xs text-[var(--muted-foreground)]">
            Awarding sets the RFQ to awarded and books the linked budget line at the winning quote.
          </p>
        </CardContent>
      </Card>

      {/* Itemised comparison */}
      {items.length > 0 && recipients.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Line-by-line comparison</CardTitle>
              <span className="text-xs text-[var(--muted-foreground)]">
                Enter each supplier&apos;s price per item — the best price per line is highlighted, and
                totals sync to the recipient&apos;s quote.
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <LineQuoteGrid
              items={items}
              recipients={recipients}
              quotes={quotes}
              onSave={saveLineQuote}
            />
          </CardContent>
        </Card>
      )}

      {/* Quote attachments per recipient */}
      {recipients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quote attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recipients.map((r) => (
              <RecipientAttachments
                key={r.id}
                eventId={eventId}
                recipient={r}
                files={attachments.filter((a) => a.recipientId === r.id)}
                onChange={() => router.refresh()}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecipientAttachments({
  eventId,
  recipient,
  files,
  onChange,
}: {
  eventId: string;
  recipient: Recipient;
  files: RfqAttachment[];
  onChange: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("recipientId", recipient.id);
    fd.set("eventId", eventId);
    startTransition(async () => {
      const res = await addRfqAttachment(fd);
      if (res.error) setError(res.error);
      else {
        formRef.current?.reset();
        onChange();
      }
    });
  }
  function onRemove(id: string) {
    startTransition(() => void removeRfqAttachment({ attachmentId: id, eventId }).then(onChange).catch(() => {}));
  }

  return (
    <div className="rounded-md border p-2.5">
      <div className="mb-1.5 text-sm font-medium">{recipient.supplierName}</div>
      {files.length > 0 ? (
        <ul className="mb-2 divide-y text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 py-1">
              <span className="min-w-0 truncate">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                    {f.label}
                  </a>
                ) : (
                  f.label
                )}
              </span>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="shrink-0 text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">No files yet.</p>
      )}
      <form ref={formRef} onSubmit={onUpload} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="label"
          placeholder="Label (optional)"
          className="h-8 flex-1 rounded-md border bg-[var(--card)] px-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <input type="file" name="file" required className="text-sm" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
        {error && <span className="w-full text-xs text-[var(--destructive)]">{error}</span>}
      </form>
    </div>
  );
}

function LineQuoteGrid({
  items,
  recipients,
  quotes,
  onSave,
}: {
  items: Item[];
  recipients: Recipient[];
  quotes: Map<string, number | null>;
  onSave: (recipientId: string, itemId: string, cents: number | null) => void;
}) {
  const cells = recipients.flatMap((r) =>
    items.map((it) => ({
      recipientId: r.id,
      itemId: it.id,
      lineTotalCents: quotes.get(`${r.id}:${it.id}`) ?? null,
    })),
  );
  const cmpLine = compareLineQuotes(
    items.map((i) => i.id),
    recipients.map((r) => r.id),
    cells,
  );
  const cmpTotal = compareQuotes(recipients.map((r) => ({ id: r.id, quotedExGstCents: r.quotedExGstCents })));
  const multi = recipients.length > 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead className="text-left text-xs text-[var(--muted-foreground)]">
          <tr>
            <th className="py-1 pr-2 font-medium">Item</th>
            {recipients.map((r) => (
              <th key={r.id} className="py-1 text-right font-medium">
                {r.supplierName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const best = cmpLine.bestByItem[it.id];
            return (
              <tr key={it.id} className="border-t">
                <td className="min-w-0 py-1.5 pr-2">{it.description}</td>
                {recipients.map((r) => {
                  const cents = quotes.get(`${r.id}:${it.id}`) ?? null;
                  const isBest = multi && best != null && best.recipientId === r.id;
                  return (
                    <td key={r.id} className={`py-1.5 text-right ${isBest ? "bg-green-50/60" : ""}`}>
                      <MoneyInput cents={cents} onSave={(c) => onSave(r.id, it.id, c)} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2">
            <td className="py-1.5 pr-2 font-medium">Total ex-GST</td>
            {recipients.map((r) => {
              const isBest = multi && isBestQuote(r.id, cmpTotal);
              return (
                <td
                  key={r.id}
                  className={`py-1.5 text-right font-medium tabular-nums ${isBest ? "text-[var(--success)]" : ""}`}
                >
                  {r.quotedExGstCents != null ? formatCents(r.quotedExGstCents) : "—"}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <input
      defaultValue={value}
      onBlur={(e) => {
        if (e.target.value !== value) onSave(e.target.value);
      }}
      className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
    />
  );
}

function DateInput({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  return (
    <input
      type="date"
      defaultValue={value ?? ""}
      onChange={(e) => onSave(e.target.value)}
      className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
      className="w-28 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}
