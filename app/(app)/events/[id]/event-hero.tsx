"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PhaseInput } from "@/lib/templates/schedule-phases";
import { updateEventDates, uploadEventImage, removeEventImage } from "../../actions";

const PHASE_ROWS: { key: keyof PhaseInput; label: string }[] = [
  { key: "bumpIn", label: "Bump-in" },
  { key: "eventDays", label: "Event day(s)" },
  { key: "bumpOut", label: "Bump-out" },
];

export function EventHero({
  eventId,
  name,
  imageUrl,
  phases: initialPhases,
  canEdit,
}: {
  eventId: string;
  name: string;
  imageUrl: string | null;
  phases: PhaseInput;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [phases, setPhases] = useState<PhaseInput>(initialPhases);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setPhase(phase: keyof PhaseInput, bound: "from" | "to", value: string) {
    setSaved(null);
    setPhases((p) => ({ ...p, [phase]: { ...p[phase], [bound]: value || null } }));
  }
  function saveDates() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      try {
        const res = await updateEventDates({ eventId, ...phases });
        setSaved(`Schedule updated · +${res.inserted} / −${res.deleted} phase days`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save dates.");
      }
    });
  }

  return (
    <Card id="event-dates" className="overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="h-52 w-full object-cover" />
      ) : (
        <div className="flex h-52 w-full items-center justify-center bg-gradient-to-br from-[var(--accent)] to-[var(--muted)] text-sm text-[var(--muted-foreground)]">
          {canEdit ? "Add a cover image below" : "No cover image"}
        </div>
      )}

      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          {canEdit && <ImageControls eventId={eventId} hasImage={!!imageUrl} onChange={() => router.refresh()} />}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Phase dates
          </div>
          {PHASE_ROWS.map((p) => (
            <div key={p.key} className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-sm">{p.label}</span>
              <input
                type="date"
                disabled={!canEdit}
                value={phases[p.key].from ?? ""}
                onChange={(e) => setPhase(p.key, "from", e.target.value)}
                className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm disabled:opacity-60"
              />
              <span className="text-xs text-[var(--muted-foreground)]">to</span>
              <input
                type="date"
                disabled={!canEdit}
                value={phases[p.key].to ?? ""}
                onChange={(e) => setPhase(p.key, "to", e.target.value)}
                className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm disabled:opacity-60"
              />
            </div>
          ))}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="button" size="sm" onClick={saveDates} disabled={pending}>
                {pending ? "Saving…" : "Save dates & rebuild schedule"}
              </Button>
              <span className="text-xs text-[var(--muted-foreground)]">
                Saving regenerates the bump-in / event / bump-out days on the schedule (your manual entries
                are kept).
              </span>
              {saved && <span className="text-xs text-[var(--success)]">{saved}</span>}
              {error && <span className="text-xs text-[var(--destructive)]">{error}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ImageControls({
  eventId,
  hasImage,
  onChange,
}: {
  eventId: string;
  hasImage: boolean;
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadEventImage(fd);
      if (res.error) setError(res.error);
      else onChange();
      if (fileRef.current) fileRef.current.value = "";
    });
  }
  function onRemove() {
    startTransition(() => void removeEventImage({ eventId }).then(onChange).catch(() => {}));
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
        {pending ? "Uploading…" : hasImage ? "Change image" : "Add cover image"}
      </Button>
      {hasImage && (
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
        >
          remove
        </button>
      )}
      {error && <span className="text-xs text-[var(--destructive)]">{error}</span>}
    </div>
  );
}
