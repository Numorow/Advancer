"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateSupplierText,
  updateSupplierFlag,
  updateSupplierCategories,
} from "../actions";

export interface SupplierDetail {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  abn: string | null;
  notes: string | null;
  insurance: boolean;
  preferred: boolean;
  categories: string;
}

type TextField = "name" | "contact_name" | "email" | "phone" | "abn" | "notes";

export function SupplierDetailForm({ supplier }: { supplier: SupplierDetail }) {
  const [s, setS] = useState(supplier);
  const [, startTransition] = useTransition();

  function field(name: TextField, label: string) {
    return (
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
        <input
          defaultValue={s[name] ?? ""}
          onBlur={(e) => {
            const value = e.target.value;
            if (value === (s[name] ?? "")) return;
            setS((p) => ({ ...p, [name]: value }));
            startTransition(() => void updateSupplierText({ supplierId: s.id, field: name, value }).catch(() => {}));
          }}
          className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </label>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {field("name", "Name")}
        {field("contact_name", "Contact")}
        {field("email", "Email")}
        {field("phone", "Phone")}
        {field("abn", "ABN")}
        <label className="block space-y-1">
          <span className="text-xs text-[var(--muted-foreground)]">Service categories (comma separated)</span>
          <input
            defaultValue={s.categories}
            onBlur={(e) => {
              const value = e.target.value;
              if (value === s.categories) return;
              setS((p) => ({ ...p, categories: value }));
              startTransition(() => void updateSupplierCategories({ supplierId: s.id, value }).catch(() => {}));
            }}
            className="h-9 w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs text-[var(--muted-foreground)]">Notes</span>
          <textarea
            defaultValue={s.notes ?? ""}
            onBlur={(e) => {
              const value = e.target.value;
              if (value === (s.notes ?? "")) return;
              setS((p) => ({ ...p, notes: value }));
              startTransition(() => void updateSupplierText({ supplierId: s.id, field: "notes", value }).catch(() => {}));
            }}
            rows={3}
            className="w-full rounded-md border bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>
        <div className="flex items-center gap-6 sm:col-span-2">
          <Toggle
            label="Insurance on file"
            checked={s.insurance}
            onChange={(v) => {
              setS((p) => ({ ...p, insurance: v }));
              startTransition(() => void updateSupplierFlag({ supplierId: s.id, field: "insurance", value: v }).catch(() => {}));
            }}
          />
          <Toggle
            label="Preferred supplier"
            checked={s.preferred}
            onChange={(v) => {
              setS((p) => ({ ...p, preferred: v }));
              startTransition(() => void updateSupplierFlag({ supplierId: s.id, field: "preferred", value: v }).catch(() => {}));
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}
