"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditableCell } from "@/components/editable-cell";
import { addEventDocument, updateEventDocumentField, removeEventDocument } from "./actions";

export interface DocRow {
  id: string;
  title: string;
  category: string | null;
  kind: "file" | "link";
  url: string | null;
  supplierId: string | null;
  rfqId: string | null;
  supplierName: string | null;
  rfqLabel: string | null;
  createdAt: string;
}
interface Opt {
  id: string;
  label: string;
}
interface SupplierOpt {
  id: string;
  name: string;
}

export function DocumentsView({
  eventId,
  documents,
  suppliers,
  rfqs,
}: {
  eventId: string;
  documents: DocRow[];
  suppliers: SupplierOpt[];
  rfqs: Opt[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [, startTransition] = useTransition();

  const categories = [...new Set(documents.map((d) => d.category).filter((c): c is string => Boolean(c)))].sort();
  const visible = filter
    ? documents.filter((d) => (filter === "__none__" ? !d.category : d.category === filter))
    : documents;

  function editField(docId: string, field: "title" | "category", value: string) {
    startTransition(() => void updateEventDocumentField({ docId, eventId, field, value }).catch(() => {}));
  }
  function remove(docId: string) {
    startTransition(() => void removeEventDocument({ docId, eventId }).then(() => router.refresh()).catch(() => {}));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Register ({documents.length})</CardTitle>
            {categories.length > 0 && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__none__">Uncategorised</option>
              </select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="text-left text-xs text-[var(--muted-foreground)]">
                <tr>
                  <th className="py-1 pr-2 font-medium">Title</th>
                  <th className="py-1 pr-2 font-medium">Category</th>
                  <th className="py-1 pr-2 font-medium">Linked to</th>
                  <th className="py-1 pr-2 font-medium">File</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id} className="border-t align-top">
                    <td className="py-1.5 pr-2">
                      <EditableCell value={d.title} onSave={(v) => editField(d.id, "title", v)} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <EditableCell value={d.category} placeholder="—" onSave={(v) => editField(d.id, "category", v)} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="flex flex-wrap gap-1">
                        {d.supplierName && <Badge tone="muted">{d.supplierName}</Badge>}
                        {d.rfqLabel && <Badge tone="info">{d.rfqLabel}</Badge>}
                        {!d.supplierName && !d.rfqLabel && <span className="text-[var(--muted-foreground)]">—</span>}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                          {d.kind === "file" ? "download" : "open link"}
                        </a>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">{d.kind}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                      >
                        remove
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--muted-foreground)]">
                      No documents yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AddDocumentForm eventId={eventId} suppliers={suppliers} rfqs={rfqs} onAdded={() => router.refresh()} />
    </div>
  );
}

function AddDocumentForm({
  eventId,
  suppliers,
  rfqs,
  onAdded,
}: {
  eventId: string;
  suppliers: SupplierOpt[];
  rfqs: Opt[];
  onAdded: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("eventId", eventId);
    startTransition(async () => {
      const res = await addEventDocument(fd);
      if (res.error) setError(res.error);
      else {
        formRef.current?.reset();
        onAdded();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a document</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-[var(--muted-foreground)]">Title</span>
            <input
              name="title"
              required
              placeholder="e.g. Public liability certificate"
              className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--muted-foreground)]">Category</span>
            <input
              name="category"
              placeholder="e.g. Insurance, Permit, Contract"
              className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--muted-foreground)]">Upload a file</span>
            <input name="file" type="file" className="block w-full text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--muted-foreground)]">…or paste a link</span>
            <input
              name="externalUrl"
              type="url"
              placeholder="https://…"
              className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--muted-foreground)]">Link to supplier (optional)</span>
            <select name="supplierId" className="h-9 w-full rounded-md border bg-[var(--card)] px-2 text-sm">
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--muted-foreground)]">Link to RFQ (optional)</span>
            <select name="rfqId" className="h-9 w-full rounded-md border bg-[var(--card)] px-2 text-sm">
              <option value="">—</option>
              {rfqs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding…" : "Add document"}
            </Button>
            {error && <span className="text-xs text-[var(--destructive)]">{error}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
