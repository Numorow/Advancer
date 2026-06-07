"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { phaseScheduleEntries, type PhaseInput } from "@/lib/templates/schedule-phases";
import { SCHEDULE_TYPES } from "@/lib/import/types";
import { createEvent } from "../../actions";

const TYPE_LABELS: Record<string, string> = {
  ON_SITE: "On-site",
  INSTALL: "Install",
  COLLECTION: "Collection",
  DELIVERY: "Delivery",
  SHOW_TIME: "Show time",
  BUMP_OUT: "Bump out",
  DROP_OFF: "Drop off",
  PICK_UP: "Pick up",
  SECURITY: "Security",
};

interface EntryRow {
  key: number;
  date: string;
  startTime: string;
  type: string;
  action: string;
}

const emptyPhases: PhaseInput = {
  bumpIn: { from: null, to: null },
  eventDays: { from: null, to: null },
  bumpOut: { from: null, to: null },
};

export function NewEventForm() {
  const router = useRouter();
  const keyRef = useRef(1);
  const [name, setName] = useState("");
  const [phases, setPhases] = useState<PhaseInput>(emptyPhases);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setPhase(phase: keyof PhaseInput, bound: "from" | "to", value: string) {
    setPhases((p) => ({ ...p, [phase]: { ...p[phase], [bound]: value || null } }));
  }

  function generate() {
    const generated = phaseScheduleEntries(phases).map((e) => ({
      key: keyRef.current++,
      date: e.date,
      startTime: "",
      type: e.type,
      action: e.action,
    }));
    // keep any manual rows that have no date (purely custom) so they aren't lost
    setEntries((prev) => [...generated, ...prev.filter((r) => !r.date)]);
  }

  function addEntry() {
    setEntries((rows) => [...rows, { key: keyRef.current++, date: "", startTime: "", type: "", action: "" }]);
  }
  function patchEntry(key: number, change: Partial<EntryRow>) {
    setEntries((rows) => rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }
  function removeEntry(key: number) {
    setEntries((rows) => rows.filter((r) => r.key !== key));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setError("Please name the event.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { eventId } = await createEvent({
          name: n,
          entries: entries.map((r) => ({
            date: r.date || null,
            startTime: r.startTime || null,
            type: r.type || null,
            action: r.action || null,
          })),
        });
        router.push(`/events/${eventId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create event");
      }
    });
  }

  const phaseRows: { key: keyof PhaseInput; label: string }[] = [
    { key: "bumpIn", label: "Bump-in" },
    { key: "eventDays", label: "Event day(s)" },
    { key: "bumpOut", label: "Bump-out" },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Event</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs text-[var(--muted-foreground)]">Event name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Calcio Italiano 2027"
              className="h-10 w-full max-w-md rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Phase dates
            </div>
            {phaseRows.map((p) => (
              <div key={p.key} className="flex flex-wrap items-center gap-2">
                <span className="w-28 text-sm">{p.label}</span>
                <input
                  type="date"
                  value={phases[p.key].from ?? ""}
                  onChange={(e) => setPhase(p.key, "from", e.target.value)}
                  className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm"
                />
                <span className="text-xs text-[var(--muted-foreground)]">to</span>
                <input
                  type="date"
                  value={phases[p.key].to ?? ""}
                  onChange={(e) => setPhase(p.key, "to", e.target.value)}
                  className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm"
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={generate}>
              Build schedule from dates
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Master schedule ({entries.length})</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addEntry}>
              Add entry
            </Button>
          </div>
          <CardDescription>
            One row was created per phase day — edit times/actions, or add your own
            entries. You can also fill the schedule in fully after creating.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No entries yet — set the phase dates above and click “Build schedule
              from dates”, or add entries manually.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-[var(--muted-foreground)]">
                  <tr>
                    <th className="py-1 font-medium">Date</th>
                    <th className="py-1 font-medium">Start</th>
                    <th className="py-1 font-medium">Type</th>
                    <th className="py-1 font-medium">Action</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((r) => (
                    <tr key={r.key} className="border-t">
                      <td className="py-1 pr-2">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => patchEntry(r.key, { date: e.target.value })}
                          className="h-8 rounded border bg-[var(--card)] px-2 text-sm"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="time"
                          value={r.startTime}
                          onChange={(e) => patchEntry(r.key, { startTime: e.target.value })}
                          className="h-8 rounded border bg-[var(--card)] px-2 text-sm"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <select
                          value={r.type}
                          onChange={(e) => patchEntry(r.key, { type: e.target.value })}
                          className="h-8 rounded border bg-[var(--card)] px-2 text-sm"
                        >
                          <option value="">—</option>
                          {SCHEDULE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          value={r.action}
                          onChange={(e) => patchEntry(r.key, { action: e.target.value })}
                          placeholder="action"
                          className="h-8 w-full rounded border bg-[var(--card)] px-2 text-sm"
                        />
                      </td>
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeEntry(r.key)}
                          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                        >
                          remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create event"}
        </Button>
        <a href="/" className="text-sm text-[var(--muted-foreground)] hover:underline">
          Cancel
        </a>
      </div>
    </form>
  );
}
