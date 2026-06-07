import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteView, type SiteEntry, type SiteNote } from "./site-view";

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day } = await searchParams;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("name, start_date")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!event) notFound();

  // distinct build days
  const { data: dayRows } = await supabase
    .from("schedule_entries")
    .select("event_date")
    .eq("event_id", id)
    .is("deleted_at", null)
    .not("event_date", "is", null)
    .order("event_date", { ascending: true });
  const days = [...new Set((dayRows ?? []).map((d) => d.event_date as string))];

  const today = new Date().toISOString().slice(0, 10);
  const selectedDay = day ?? (days.includes(today) ? today : (days[0] ?? event.start_date ?? today));

  const { data: entryRows } = await supabase
    .from("schedule_entries")
    .select("id, start_time, finish_time, type, action, location, site_poc, notes, completed, critical_path, supplier_text, suppliers(name, phone, email)")
    .eq("event_id", id)
    .eq("event_date", selectedDay)
    .is("deleted_at", null)
    .order("sort", { ascending: true });

  const entries: SiteEntry[] = (entryRows ?? []).map((e) => {
    const sup = e.suppliers as unknown as { name: string; phone: string | null; email: string | null } | null;
    return {
      id: e.id,
      startTime: e.start_time ? e.start_time.slice(0, 5) : null,
      finishTime: e.finish_time ? e.finish_time.slice(0, 5) : null,
      type: e.type,
      action: e.action,
      location: e.location,
      sitePoc: e.site_poc,
      notes: e.notes,
      completed: e.completed,
      criticalPath: e.critical_path,
      supplierName: sup?.name ?? e.supplier_text ?? null,
      supplierPhone: sup?.phone ?? null,
      supplierEmail: sup?.email ?? null,
    };
  });

  const { data: noteRows } = await supabase
    .from("site_notes")
    .select("id, body, severity, photo_path, resolved, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // sign photo URLs
  const paths = (noteRows ?? []).map((n) => n.photo_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("site-photos").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const notes: SiteNote[] = (noteRows ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    severity: n.severity,
    resolved: n.resolved,
    createdAt: n.created_at,
    photoUrl: n.photo_path ? (signed.get(n.photo_path) ?? null) : null,
  }));

  return (
    <SiteView
      eventId={id}
      eventName={event.name}
      days={days}
      selectedDay={selectedDay}
      today={today}
      entries={entries}
      notes={notes}
    />
  );
}
