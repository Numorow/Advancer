import { createClient } from "@/lib/supabase/server";
import { ManagementGrid, type ManagementRow } from "./management-grid";

export default async function ManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("management_tasks")
    .select("id, week_date, week_label, task_no, task, hours, completed, role, rate_cents")
    .eq("event_id", id)
    .is("deleted_at", null)
    .order("week_date", { ascending: true, nullsFirst: true })
    .order("sort", { ascending: true });

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Management tasks</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          The pre-event work, by week. Estimated management cost (hours × rate)
          and completion compute live.
        </p>
      </div>
      <ManagementGrid eventId={id} rows={rows} />
    </div>
  );
}
