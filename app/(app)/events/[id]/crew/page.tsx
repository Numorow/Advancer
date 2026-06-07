import { createClient } from "@/lib/supabase/server";
import { CrewGrid, type CrewRow } from "./crew-grid";

export default async function CrewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: shifts }, { data: roles }] = await Promise.all([
    supabase
      .from("crew_shifts")
      .select(
        "id, shift_date, day_label, role_name, person, start_time, finish_time, scheduled_hours, actual_hours, rate_cents",
      )
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("shift_date", { ascending: true, nullsFirst: true })
      .order("sort", { ascending: true }),
    supabase.from("crew_roles").select("name").order("sort", { ascending: true }),
  ]);

  const num = (v: number | string | null) => (v == null ? null : Number(v));
  const rows: CrewRow[] = (shifts ?? []).map((s) => ({
    id: s.id,
    shiftDate: s.shift_date,
    dayLabel: s.day_label,
    roleName: s.role_name,
    person: s.person,
    startTime: s.start_time ? s.start_time.slice(0, 5) : null,
    finishTime: s.finish_time ? s.finish_time.slice(0, 5) : null,
    scheduledHours: num(s.scheduled_hours),
    actualHours: num(s.actual_hours),
    rateCents: s.rate_cents,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Crew &amp; labour</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Shifts by day with rates and hours. Totals (ex-GST, GST, inc-GST) and a
          per-role rollup compute live.
        </p>
      </div>
      <CrewGrid eventId={id} rows={rows} roleNames={(roles ?? []).map((r) => r.name)} />
    </div>
  );
}
