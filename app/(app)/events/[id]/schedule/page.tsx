import { createClient } from "@/lib/supabase/server";
import { ScheduleGrid, type ScheduleRow } from "./schedule-grid";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("schedule_entries")
    .select(
      "id, event_date, start_time, finish_time, type, action, location, site_poc, notes, completed, critical_path, supplier_text, suppliers(name), sort",
    )
    .eq("event_id", id)
    .is("deleted_at", null)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("sort", { ascending: true });

  const rows: ScheduleRow[] = (entries ?? []).map((e) => ({
    id: e.id,
    eventDate: e.event_date,
    startTime: e.start_time ? e.start_time.slice(0, 5) : null,
    finishTime: e.finish_time ? e.finish_time.slice(0, 5) : null,
    type: e.type,
    action: e.action,
    location: e.location,
    sitePoc: e.site_poc,
    notes: e.notes,
    completed: e.completed,
    criticalPath: e.critical_path,
    supplier: (e.suppliers as unknown as { name: string } | null)?.name ?? e.supplier_text ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Master schedule</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Grouped by build date. Filter by type, supplier or text; tick items
          complete on site.
        </p>
      </div>
      <ScheduleGrid eventId={id} rows={rows} />
    </div>
  );
}
