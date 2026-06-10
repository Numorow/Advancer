"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditableCell } from "@/components/editable-cell";
import { addReferenceValue, updateReferenceValue, removeReferenceValue } from "../actions";

export interface RefRow {
  id: string;
  category: string;
  value: string;
  label: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  person: "People",
  schedule_type: "Schedule types",
  zone: "Zones",
  truck_type: "Truck types",
};

export function ReferenceGrid({ rows: initial, canEdit }: { rows: RefRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [newCategory, setNewCategory] = useState("");
  const [newCatValue, setNewCatValue] = useState("");
  const [, startTransition] = useTransition();

  const groups = useMemo(() => {
    const map = new Map<string, RefRow[]>();
    for (const r of rows) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }
    return [...map.keys()].sort().map((category) => ({ category, items: map.get(category) ?? [] }));
  }, [rows]);

  function saveField(id: string, field: "value" | "label", value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    startTransition(() => void updateReferenceValue({ id, field, value }).catch(() => {}));
  }
  function remove(id: string) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(() => void removeReferenceValue({ id }).catch(() => setRows(prev)));
  }
  function addValue(category: string, value: string, reset: () => void) {
    const v = value.trim();
    if (!v) return;
    reset();
    startTransition(async () => {
      try {
        const { id } = await addReferenceValue({ category, value: v });
        setRows((rs) => [...rs, { id, category, value: v, label: null }]);
      } catch {
        router.refresh();
      }
    });
  }
  function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const cat = newCategory.trim();
    const v = newCatValue.trim();
    if (!cat || !v) return;
    setNewCategory("");
    setNewCatValue("");
    startTransition(async () => {
      try {
        const { id } = await addReferenceValue({ category: cat, value: v });
        setRows((rs) => [...rs, { id, category: cat, value: v, label: null }]);
      } catch {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <CategoryCard key={g.category} category={g.category} items={g.items} canEdit={canEdit} onSave={saveField} onRemove={remove} onAdd={addValue} />
      ))}
      {groups.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No reference data yet.</p>}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Add a category</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addCategory} className="flex flex-wrap items-center gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category key (e.g. accreditation)"
                className="h-9 w-56 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <input
                value={newCatValue}
                onChange={(e) => setNewCatValue(e.target.value)}
                placeholder="First value"
                className="h-9 w-48 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <Button type="submit" size="sm" variant="outline">
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  items,
  canEdit,
  onSave,
  onRemove,
  onAdd,
}: {
  category: string;
  items: RefRow[];
  canEdit: boolean;
  onSave: (id: string, field: "value" | "label", value: string) => void;
  onRemove: (id: string) => void;
  onAdd: (category: string, value: string, reset: () => void) => void;
}) {
  const [val, setVal] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {CATEGORY_LABEL[category] ?? category}{" "}
          <span className="text-xs font-normal text-[var(--muted-foreground)]">· {category}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.map((r) => (
          <div key={r.id} className="group flex items-center gap-2 border-b pb-1.5">
            <div className="min-w-0 flex-1">
              {canEdit ? <EditableCell value={r.value} onSave={(v) => onSave(r.id, "value", v)} /> : r.value}
            </div>
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <EditableCell value={r.label} placeholder="label (optional)" onSave={(v) => onSave(r.id, "label", v)} />
              ) : (
                <span className="text-[var(--muted-foreground)]">{r.label ?? ""}</span>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                className="shrink-0 text-xs text-[var(--muted-foreground)] opacity-0 transition hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100"
              >
                remove
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAdd(category, val, () => setVal(""));
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Add a value"
              className="h-9 flex-1 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <Button type="submit" size="sm" variant="outline">
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
