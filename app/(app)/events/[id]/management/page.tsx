import { createClient } from "@/lib/supabase/server";
import { weekMondays } from "@/lib/calc/management";
import { ManagementGrid, type ManagementRow } from "./management-grid";

export default async function ManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: tasks }, { data: event }] = await Promise.all([
    supabase
      .from("management_tasks")
      .select("id, week_date, week_label, task_no, task, hours, completed, role, rate_cents")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("week_date", { ascending: true, nullsFirst: true })
      .order("sort", { ascending: true }),
    supabase.from("events").select("end_date").eq("id", id).maybeSingle(),
  ]);

  const rows: ManagementRow[] = (tasks ?? []).map((t) => ({
    id: t.id,
    weekDate: t.week_date,
    weekLabel: t.week_label,
    taskNo: t.task_no,
    task: t.task,
    hours: t.hours == null ? null : Number(t.hours),
    completed: t.completed,
    role: t.role,
    rateCents: t.rate_cents,
  }));

  // Pre-fill a heading per week from the current week to the end of the event
  // (4 weeks ahead when the event has no end date yet).
  const today = new Date().toISOString().slice(0, 10);
  const fallbackEnd = new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10);
  const end = event?.end_date && event.end_date > today ? event.end_date : fallbackEnd;
  const seedWeeks = weekMondays(today, end);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Management</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          The pre-event work, by week. Estimated management cost (hours × rate)
          and completion compute live.
        </p>
      </div>
      <ManagementGrid eventId={id} rows={rows} seedWeeks={seedWeeks} />
    </div>
  );
}
