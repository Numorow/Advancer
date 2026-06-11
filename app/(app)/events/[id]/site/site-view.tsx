"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IMAGE_ACCEPT } from "@/lib/images";
import { TYPE_CHIP_CLASSES } from "../schedule/schedule-shared";
import { updateScheduleToggle } from "../schedule/actions";
import { addSiteNote, resolveSiteNote } from "./actions";

export interface SiteEntry {
  id: string;
  startTime: string | null;
  finishTime: string | null;
  type: string | null;
  action: string | null;
  location: string | null;
  sitePoc: string | null;
  notes: string | null;
  completed: boolean;
  criticalPath: boolean;
  supplierName: string | null;
  supplierPhone: string | null;
  supplierEmail: string | null;
}

export interface SiteNote {
  id: string;
  body: string;
  severity: "info" | "issue" | "urgent";
  resolved: boolean;
  createdAt: string;
  photoUrl: string | null;
}

export interface KeyContact {
  id: string;
  position: string | null;
  name: string | null;
  company: string | null;
  mobile: string | null;
  email: string | null;
}

const sevTone: Record<SiteNote["severity"], "muted" | "warning" | "danger"> = {
  info: "muted",
  issue: "warning",
  urgent: "danger",
};

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function SiteView({
  eventId,
  eventName,
  days,
  selectedDay,
  today,
  entries: initialEntries,
  notes,
  keyContacts,
}: {
  eventId: string;
  eventName: string;
  days: string[];
  selectedDay: string;
  today: string;
  entries: SiteEntry[];
  notes: SiteNote[];
  keyContacts: KeyContact[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Adopt server re-renders (foreign edits via LiveRefresh, own via revalidatePath).
  useEffect(() => setEntries(initialEntries), [initialEntries]);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function toggle(id: string, completed: boolean) {
    const prev = entries;
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, completed } : e)));
    startTransition(() =>
      void updateScheduleToggle({ entryId: id, eventId, field: "completed", value: completed }).catch(() => setEntries(prev)),
    );
  }

  function onSubmitNote(e: React.FormEvent) {
    e.preventDefault();
    setNoteError(null);
    const fd = new FormData(formRef.current!);
    fd.set("eventId", eventId);
    startTransition(async () => {
      const res = await addSiteNote(fd);
      if (res.error) setNoteError(res.error);
      else {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  const critical = entries.filter((e) => e.criticalPath && !e.completed);
  const doneCount = entries.filter((e) => e.completed).length;

  return (
    <div className="mx-auto max-w-md space-y-4 pb-16">
      <header className="sticky top-14 z-10 -mx-5 bg-[var(--background)]/95 px-5 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold leading-tight">Site mode</div>
            <div className="text-xs text-[var(--muted-foreground)]">{eventName}</div>
          </div>
          <Badge tone="info">
            {doneCount}/{entries.length} done
          </Badge>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {days.map((d) => (
            <Link
              key={d}
              href={`/events/${eventId}/site?day=${d}`}
              scroll={false}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                d === selectedDay
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border bg-[var(--card)]"
              }`}
            >
              {dayLabel(d)}
              {d === today ? " (today)" : ""}
            </Link>
          ))}
          {days.length === 0 && <span className="text-xs text-[var(--muted-foreground)]">No build dates</span>}
        </div>
      </header>

      {critical.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--destructive)]">
            Critical — outstanding ({critical.length})
          </h2>
          <div className="space-y-2">
            {critical.map((e) => (
              <EntryCard key={`crit-${e.id}`} entry={e} onToggle={toggle} expanded={expanded === e.id} onExpand={setExpanded} critical />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {dayLabel(selectedDay)} schedule
        </h2>
        <div className="space-y-2">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} onToggle={toggle} expanded={expanded === e.id} onExpand={setExpanded} />
          ))}
          {entries.length === 0 && (
            <p className="rounded-md border bg-[var(--card)] p-4 text-center text-sm text-[var(--muted-foreground)]">
              Nothing scheduled for this day.
            </p>
          )}
        </div>
      </section>

      {keyContacts.length > 0 && (
        <details className="rounded-md border bg-[var(--card)]">
          <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Key contacts ({keyContacts.length})
          </summary>
          <div className="divide-y border-t">
            {keyContacts.map((c) => (
              <div key={c.id} className="px-3 py-2">
                <div className="text-sm font-medium">{c.name ?? "—"}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {[c.position, c.company].filter(Boolean).join(" · ")}
                </div>
                {(c.mobile || c.email) && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {c.mobile && (
                      <a href={`tel:${c.mobile}`} className="text-[var(--primary)]">
                        📞 {c.mobile}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-[var(--primary)]">
                        ✉︎ {c.email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <section>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Site notes
        </h2>
        <form ref={formRef} onSubmit={onSubmitNote} className="space-y-2 rounded-md border bg-[var(--card)] p-3">
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Log a site note or flag an issue…"
            className="w-full rounded-md border bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <div className="flex items-center gap-2">
            <select name="severity" defaultValue="info" className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm">
              <option value="info">Note</option>
              <option value="issue">Issue</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              type="file"
              name="photo"
              accept={IMAGE_ACCEPT}
              capture="environment"
              className="flex-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-[var(--muted)] file:px-2 file:py-1.5 file:text-xs"
            />
            <Button type="submit" size="sm" disabled={pending}>
              Post
            </Button>
          </div>
          {noteError && <p className="text-xs text-[var(--destructive)]">{noteError}</p>}
        </form>

        <div className="mt-2 space-y-2">
          {notes.map((n) => (
            <div key={n.id} className={`rounded-md border bg-[var(--card)] p-3 ${n.resolved ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <Badge tone={sevTone[n.severity]}>{n.severity}</Badge>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      void resolveSiteNote({ noteId: n.id, eventId, resolved: !n.resolved }).then(() => router.refresh()).catch(() => {}),
                    )
                  }
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {n.resolved ? "reopen" : "resolve"}
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
              {n.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.photoUrl} alt="site photo" className="mt-2 max-h-56 w-full rounded-md object-cover" />
              )}
            </div>
          ))}
          {notes.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No site notes yet.</p>}
        </div>
      </section>
    </div>
  );
}

function EntryCard({
  entry,
  onToggle,
  expanded,
  onExpand,
  critical,
}: {
  entry: SiteEntry;
  onToggle: (id: string, completed: boolean) => void;
  expanded: boolean;
  onExpand: (id: string | null) => void;
  critical?: boolean;
}) {
  return (
    <div className={`rounded-md border bg-[var(--card)] ${entry.completed ? "opacity-70" : ""} ${critical ? "border-[var(--destructive)]" : ""}`}>
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={entry.completed}
          onChange={(e) => onToggle(entry.id, e.target.checked)}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-[var(--primary)]"
        />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onExpand(expanded ? null : entry.id)}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{entry.startTime ?? "—"}</span>
            {entry.type && (
              <Badge tone="muted" className={TYPE_CHIP_CLASSES[entry.type] ?? ""}>
                {entry.type.replace(/_/g, " ").toLowerCase()}
              </Badge>
            )}
            {entry.criticalPath && <Badge tone="danger">critical</Badge>}
          </div>
          <div className={`mt-0.5 text-sm ${entry.completed ? "line-through" : ""}`}>{entry.action ?? "—"}</div>
          {entry.location && <div className="text-xs text-[var(--muted-foreground)]">📍 {entry.location}</div>}
        </button>
      </div>
      {expanded && (
        <div className="space-y-1.5 border-t px-3 py-2 text-sm">
          {entry.supplierName && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{entry.supplierName}</span>
              {entry.supplierPhone && (
                <a href={`tel:${entry.supplierPhone}`} className="text-[var(--primary)]">
                  📞 {entry.supplierPhone}
                </a>
              )}
              {entry.supplierEmail && (
                <a href={`mailto:${entry.supplierEmail}`} className="text-[var(--primary)]">
                  ✉︎ {entry.supplierEmail}
                </a>
              )}
            </div>
          )}
          {entry.sitePoc && <div className="text-[var(--muted-foreground)]">Site POC: {entry.sitePoc}</div>}
          {entry.finishTime && <div className="text-[var(--muted-foreground)]">Finish: {entry.finishTime}</div>}
          {entry.notes && <div className="whitespace-pre-wrap">{entry.notes}</div>}
        </div>
      )}
    </div>
  );
}
