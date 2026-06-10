import { createClient } from "@/lib/supabase/server";
import { ScheduleView } from "./schedule-view";
import type { ScheduleRow } from "./schedule-shared";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: entries }, { data: suppliers }] = await Promise.all([
    supabase
      .from("schedule_entries")
      .select(
        "id, event_date, start_time, finish_time, type, action, location, site_poc, notes, completed, critical_path, supplier_id, supplier_text, suppliers(name), sort",
      )
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("sort", { ascending: true }),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
  ]);

  const rows: ScheduleRow[] = (entries ?? []).map((e) => ({
    id: e.id,
    eventDate: e.event_date,
    startTime: e.start_time ? e.start_time.slice(0, 5) : null,
    finishTime: e.finish_time ? e.finish_time.slice(0, 5) : null,
    type: e.type,
    supplierId: e.supplier_id,
    supplierText: e.supplier_text,
    supplierName: (e.suppliers as unknown as { name: string } | null)?.name ?? null,
    action: e.action,
    location: e.location,
    sitePoc: e.site_poc,
    notes: e.notes,
    completed: e.completed,
    criticalPath: e.critical_path,
    sort: e.sort,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Master schedule</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Add and edit build / show / bump-out entries, assign suppliers and times, flag critical-path
          items, and switch to the timeline view.
        </p>
      </div>
      <ScheduleView eventId={id} rows={rows} suppliers={suppliers ?? []} />
    </div>
  );
}
