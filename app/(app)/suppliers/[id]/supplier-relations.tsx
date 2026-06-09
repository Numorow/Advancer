"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  addSupplierContact,
  updateSupplierContactField,
  setPrimaryContact,
  removeSupplierContact,
  addSupplierDocument,
  removeSupplierDocument,
} from "../actions";

interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}
interface Doc {
  id: string;
  label: string;
  docType: string | null;
  url: string | null;
  createdAt: string;
}

type ContactField = "name" | "role" | "email" | "phone";

export function SupplierRelations({
  supplierId,
  contacts: initialContacts,
  documents: initialDocs,
}: {
  supplierId: string;
  contacts: Contact[];
  documents: Doc[];
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [newName, setNewName] = useState("");
  const [, startTransition] = useTransition();

  function addContact(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    startTransition(async () => {
      const { id } = await addSupplierContact({ supplierId, name });
      setContacts((cs) => [
        ...cs,
        { id, name, role: null, email: null, phone: null, isPrimary: cs.length === 0 },
      ]);
    });
  }
  function editContact(contactId: string, field: ContactField, value: string) {
    setContacts((cs) => cs.map((c) => (c.id === contactId ? { ...c, [field]: value } : c)));
    startTransition(() =>
      void updateSupplierContactField({ contactId, supplierId, field, value }).catch(() => {}),
    );
  }
  function makePrimary(contactId: string) {
    setContacts((cs) => cs.map((c) => ({ ...c, isPrimary: c.id === contactId })));
    startTransition(() => void setPrimaryContact({ contactId, supplierId }).catch(() => {}));
  }
  function deleteContact(contactId: string) {
    setContacts((cs) => cs.filter((c) => c.id !== contactId));
    startTransition(() => void removeSupplierContact({ contactId, supplierId }).catch(() => {}));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Contacts ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contacts.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No contacts yet.</p>}
          {contacts.map((c) => (
            <div key={c.id} className="space-y-1.5 rounded-md border p-2.5">
              <div className="flex items-center gap-2">
                <ContactInput value={c.name} placeholder="Name" onSave={(v) => editContact(c.id, "name", v)} className="font-medium" />
                {c.isPrimary ? (
                  <Badge tone="info">primary</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => makePrimary(c.id)}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    make primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteContact(c.id)}
                  className="ml-auto text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                >
                  remove
                </button>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3">
                <ContactInput value={c.role ?? ""} placeholder="Role" onSave={(v) => editContact(c.id, "role", v)} />
                <ContactInput value={c.email ?? ""} placeholder="Email" onSave={(v) => editContact(c.id, "email", v)} />
                <ContactInput value={c.phone ?? ""} placeholder="Phone" onSave={(v) => editContact(c.id, "phone", v)} />
              </div>
            </div>
          ))}
          <form onSubmit={addContact} className="flex items-center gap-2 pt-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add a contact name"
              className="h-9 flex-1 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <Button type="submit" size="sm" variant="outline">
              Add contact
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents ({initialDocs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialDocs.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">No documents yet (insurance, ABN, capability).</p>
          )}
          <ul className="divide-y text-sm">
            {initialDocs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                      {d.label}
                    </a>
                  ) : (
                    d.label
                  )}
                  {d.docType && <span className="ml-1 text-xs text-[var(--muted-foreground)]">· {d.docType}</span>}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => void removeSupplierDocument({ docId: d.id, supplierId }).then(() => router.refresh()).catch(() => {}))
                  }
                  className="shrink-0 text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
          <UploadForm supplierId={supplierId} onUploaded={() => router.refresh()} />
        </CardContent>
      </Card>
    </div>
  );
}

function ContactInput({
  value,
  placeholder,
  onSave,
  className,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(e) => {
        if (e.target.value !== value) onSave(e.target.value);
      }}
      className={`h-8 w-full rounded-md border bg-[var(--card)] px-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)] ${className ?? ""}`}
    />
  );
}

function UploadForm({ supplierId, onUploaded }: { supplierId: string; onUploaded: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("supplierId", supplierId);
    startTransition(async () => {
      const res = await addSupplierDocument(fd);
      if (res.error) setError(res.error);
      else {
        formRef.current?.reset();
        onUploaded();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2 border-t pt-3">
      <input
        type="text"
        name="label"
        placeholder="Label (optional)"
        className="h-9 flex-1 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <input
        type="text"
        name="docType"
        placeholder="Type (e.g. insurance)"
        className="h-9 w-40 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <input type="file" name="file" required className="text-sm" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {error && <span className="w-full text-xs text-[var(--destructive)]">{error}</span>}
    </form>
  );
}
