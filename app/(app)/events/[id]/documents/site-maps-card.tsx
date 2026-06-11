"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Map, Plus, Trash2 } from "lucide-react";
import { EditableCell } from "@/components/editable-cell";
import { addSiteMap, removeSiteMap, updateSiteMap } from "./actions";

type Field = "version" | "label" | "url";

export interface SiteMapRow {
  id: string;
  version: string | null;
  label: string | null;
  url: string | null;
}

type Row = SiteMapRow & { cid: string; pending?: boolean };

export function SiteMapsCard({ eventId, maps: initial }: { eventId: string; maps: SiteMapRow[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((r) => ({ ...r, cid: r.id })));
  const [focusCid, setFocusCid] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const tempCounter = useRef(0);
  const bufferedEdits = useRef<Record<string, Partial<Record<Field, string>>>>({});

  // Adopt server re-renders (foreign edits via LiveRefresh, own via revalidatePath):
  // keep each row's stable cid, and keep optimistic rows still awaiting their id.
  useEffect(() => {
    setRows((prev) => {
      // lucide's Map icon import shadows the Map constructor here — use a record
      const cidById = Object.fromEntries(prev.map((r) => [r.id, r.cid]));
      const ids = new Set(initial.map((r) => r.id));
      const awaitingId = prev.filter((r) => r.pending && !ids.has(r.id));
      return [...initial.map((r) => ({ ...r, cid: cidById[r.id] ?? r.id })), ...awaitingId];
    });
  }, [initial]);

  function edit(row: Row, field: Field, value: string) {
    setRows((rs) => rs.map((r) => (r.cid === row.cid ? { ...r, [field]: value } : r)));
    if (row.pending) {
      bufferedEdits.current[row.cid] = { ...bufferedEdits.current[row.cid], [field]: value };
      return;
    }
    startTransition(async () => {
      try {
        await updateSiteMap({ mapId: row.id, eventId, field, value });
      } catch {
        /* surfaced on next load */
      }
    });
  }

  function add() {
    const cid = `tmp-${++tempCounter.current}`;
    setRows((rs) => [...rs, { id: cid, cid, pending: true, version: null, label: null, url: null }]);
    setFocusCid(cid);
    startTransition(async () => {
      try {
        const { id } = await addSiteMap({ eventId });
        setRows((rs) =>
          rs
            .filter((r) => !(r.id === id && r.cid !== cid)) // a resync may have adopted the server row already
            .map((r) => (r.cid === cid ? { ...r, id, pending: false } : r)),
        );
        const edits = bufferedEdits.current[cid];
        delete bufferedEdits.current[cid];
        if (edits) {
          for (const [field, value] of Object.entries(edits)) {
            await updateSiteMap({ mapId: id, eventId, field: field as Field, value });
          }
        }
      } catch {
        setRows((rs) => rs.filter((r) => r.cid !== cid));
        delete bufferedEdits.current[cid];
      }
    });
  }

  function remove(row: Row) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.cid !== row.cid));
    startTransition(async () => {
      try {
        await removeSiteMap({ mapId: row.id, eventId });
      } catch {
        setRows(prev);
      }
    });
  }

  return (
    <section className="rounded-md border">
      <div className="flex items-center gap-2 border-b bg-[var(--muted)] px-3 py-2">
        <Map className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Site maps
        </h2>
      </div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.cid} className={`group border-b last:border-b-0 ${r.pending ? "opacity-60" : ""}`}>
              <td className="w-24 px-2 py-1">
                <EditableCell
                  value={r.version}
                  placeholder="V1"
                  autoFocus={r.cid === focusCid}
                  onSave={(v) => edit(r, "version", v)}
                />
              </td>
              <td className="px-2 py-1">
                <EditableCell value={r.label} placeholder="Label" onSave={(v) => edit(r, "label", v)} />
              </td>
              <td className="w-[40%] px-2 py-1">
                <EditableCell value={r.url} placeholder="https://…" onSave={(v) => edit(r, "url", v)} />
              </td>
              <td className="w-16 px-2 py-1.5 text-right">
                <span className="inline-flex items-center gap-1">
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open site map"
                      className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    disabled={r.pending}
                    title="Delete site map"
                    className="rounded p-1 text-[var(--muted-foreground)] opacity-0 transition hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="px-2 py-1">
              <button
                type="button"
                onClick={add}
                className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add site map
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
