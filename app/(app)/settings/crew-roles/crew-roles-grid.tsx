"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditableCell } from "@/components/editable-cell";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import { addCrewRole, updateCrewRole, removeCrewRole } from "../actions";

export interface CrewRoleRow {
  id: string;
  name: string;
  rateCents: number | null;
}

export function CrewRolesGrid({ rows: initial, canEdit }: { rows: CrewRoleRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [, startTransition] = useTransition();

  function saveName(id: string, value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, name: value } : r)));
    startTransition(() => void updateCrewRole({ roleId: id, field: "name", value }).catch(() => {}));
  }
  function saveRate(id: string, cents: number | null) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, rateCents: cents } : r)));
    startTransition(() => void updateCrewRole({ roleId: id, field: "default_rate_cents", value: cents }).catch(() => {}));
  }
  function remove(id: string) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(() => void removeCrewRole({ roleId: id }).catch(() => setRows(prev)));
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setName("");
    startTransition(async () => {
      try {
        const { id } = await addCrewRole({ name: n });
        setRows((rs) => [...rs, { id, name: n, rateCents: null }]);
      } catch {
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-0">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[var(--muted)]/60 text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 text-right font-medium">Default rate / hr</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="group border-t">
                <td className="px-4 py-1.5">
                  {canEdit ? (
                    <EditableCell value={r.name} onSave={(v) => saveName(r.id, v)} />
                  ) : (
                    r.name
                  )}
                </td>
                <td className="px-4 py-1.5 text-right">
                  {canEdit ? (
                    <MoneyInput cents={r.rateCents} onSave={(c) => saveRate(r.id, c)} />
                  ) : r.rateCents != null ? (
                    formatCents(r.rateCents)
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-1.5 text-right">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      className="text-xs text-[var(--muted-foreground)] opacity-0 transition hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100"
                    >
                      remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No crew roles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canEdit && (
          <form onSubmit={add} className="flex items-center gap-2 px-4 py-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add a role (e.g. Forklift operator)"
              className="h-9 flex-1 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <Button type="submit" size="sm" variant="outline">
              Add role
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
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
      className="w-24 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}
