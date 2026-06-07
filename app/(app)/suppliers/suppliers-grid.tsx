"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditableCell } from "@/components/editable-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createSupplier,
  updateSupplierText,
  updateSupplierFlag,
  updateSupplierCategories,
  archiveSupplier,
} from "./actions";

export interface SupplierRow {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  abn: string | null;
  insurance: boolean;
  preferred: boolean;
  categories: string;
  usedBy: number;
}

type TextField = "name" | "contact_name" | "email" | "phone" | "abn";

export function SuppliersGrid({ rows: initial }: { rows: SupplierRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState("");
  const [, startTransition] = useTransition();

  function patch(id: string, change: Partial<SupplierRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  function saveText(id: string, field: TextField, value: string) {
    patch(id, { [field]: value } as Partial<SupplierRow>);
    startTransition(async () => {
      try {
        await updateSupplierText({ supplierId: id, field, value });
      } catch {
        /* revalidated on next load */
      }
    });
  }

  function saveCategories(id: string, value: string) {
    patch(id, { categories: value });
    startTransition(async () => {
      try {
        await updateSupplierCategories({ supplierId: id, value });
      } catch {
        /* ignore */
      }
    });
  }

  function toggleFlag(id: string, field: "insurance" | "preferred", value: boolean) {
    const prev = rows;
    patch(id, { [field]: value } as Partial<SupplierRow>);
    startTransition(async () => {
      try {
        await updateSupplierFlag({ supplierId: id, field, value });
      } catch {
        setRows(prev);
      }
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    startTransition(async () => {
      await createSupplier({ name });
      router.refresh();
    });
  }

  function onArchive(id: string) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(async () => {
      try {
        await archiveSupplier({ supplierId: id });
      } catch {
        setRows(prev);
      }
    });
  }

  const q = filter.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => `${r.name} ${r.contact_name ?? ""} ${r.categories}`.toLowerCase().includes(q))
    : rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${rows.length} suppliers…`}
          className="h-9 w-full max-w-xs rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <form onSubmit={onCreate} className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New supplier name"
            className="h-9 w-56 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <Button type="submit" size="sm">
            Add supplier
          </Button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              <Th className="w-[18%]">Name</Th>
              <Th>Contact</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>ABN</Th>
              <Th>Categories</Th>
              <Th className="text-center">Ins.</Th>
              <Th className="text-center">Pref.</Th>
              <Th className="text-center">Used by</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-t align-top hover:bg-[var(--muted)]/40">
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    <EditableCell value={r.name} onSave={(v) => saveText(r.id, "name", v)} />
                    <Link href={`/suppliers/${r.id}`} className="shrink-0 text-xs text-[var(--primary)] hover:underline">
                      open
                    </Link>
                  </div>
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.contact_name} placeholder="—" onSave={(v) => saveText(r.id, "contact_name", v)} />
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.email} placeholder="—" onSave={(v) => saveText(r.id, "email", v)} />
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.phone} placeholder="—" onSave={(v) => saveText(r.id, "phone", v)} />
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.abn} placeholder="—" onSave={(v) => saveText(r.id, "abn", v)} />
                </td>
                <td className="px-2 py-1">
                  <EditableCell value={r.categories} placeholder="comma, separated" onSave={(v) => saveCategories(r.id, v)} />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={r.insurance}
                    onChange={(e) => toggleFlag(r.id, "insurance", e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={r.preferred}
                    onChange={(e) => toggleFlag(r.id, "preferred", e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  {r.usedBy > 0 ? <Badge tone="info">{r.usedBy}</Badge> : <span className="text-[var(--muted-foreground)]">0</span>}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onArchive(r.id)}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                  No suppliers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
