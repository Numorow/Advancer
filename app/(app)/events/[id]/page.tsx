import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/calc/money";
import { eventDashboard, rfqSummary } from "@/lib/calc/dashboard";
import { rollupCrew } from "@/lib/calc/crew";
import { rollupManagement } from "@/lib/calc/management";

export default async function EventDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: checklist },
    { data: budget },
    { data: schedule },
    { data: crew },
    { data: management },
    { data: rfqs },
  ] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("status, rfq_status, booking_status, payment_status")
      .eq("event_id", id)
      .is("deleted_at", null),
    supabase
      .from("budget_items")
      .select("quoted_ex_gst_cents, actual_inc_gst_cents, approval_status, payment_status")
      .eq("event_id", id)
      .is("deleted_at", null),
    supabase
      .from("schedule_entries")
      .select("event_date, completed")
      .eq("event_id", id)
      .is("deleted_at", null),
    supabase
      .from("crew_shifts")
      .select("scheduled_hours, actual_hours, rate_cents")
      .eq("event_id", id)
      .is("deleted_at", null),
    supabase
      .from("management_tasks")
      .select("hours, rate_cents, completed")
      .eq("event_id", id)
      .is("deleted_at", null),
    supabase
      .from("rfqs")
      .select("status, rfq_recipients(status, quoted_ex_gst_cents)")
      .eq("event_id", id)
      .is("deleted_at", null),
  ]);

  const crewRollup = rollupCrew(
    (crew ?? []).map((c) => ({
      scheduledHours: c.scheduled_hours == null ? null : Number(c.scheduled_hours),
      actualHours: c.actual_hours == null ? null : Number(c.actual_hours),
      rateCents: c.rate_cents,
    })),
  );
  const mgmtRollup = rollupManagement(
    (management ?? []).map((m) => ({
      hours: m.hours == null ? null : Number(m.hours),
      rateCents: m.rate_cents,
      completed: m.completed,
    })),
  );

  const todayISO = new Date().toISOString().slice(0, 10);
  const d = eventDashboard(
    (budget ?? []).map((b) => ({
      quotedExGstCents: b.quoted_ex_gst_cents,
      actualIncGstCents: b.actual_inc_gst_cents,
      approvalStatus: b.approval_status,
      paymentStatus: b.payment_status,
    })),
    (checklist ?? []).map((c) => ({
      status: c.status,
      rfqStatus: c.rfq_status,
      bookingStatus: c.booking_status,
      paymentStatus: c.payment_status,
    })),
    (schedule ?? []).map((s) => ({ eventDate: s.event_date, completed: s.completed })),
    todayISO,
  );

  const rfq = rfqSummary(
    (rfqs ?? []).map((r) => ({
      status: r.status,
      recipients: (
        (r.rfq_recipients as unknown as { status: string; quoted_ex_gst_cents: number | null }[]) ?? []
      ).map((x) => ({
        status: x.status as "pending" | "sent" | "responded" | "declined",
        quotedExGstCents: x.quoted_ex_gst_cents,
      })),
    })),
  );

  const overVariance = d.budget.varianceCents > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Quoted (inc GST)" value={formatCents(d.budget.quotedIncGstCents)} />
        <Stat label="Actual (inc GST)" value={formatCents(d.budget.actualIncGstCents)} />
        <Stat
          label="Variance"
          value={formatCents(d.budget.varianceCents, { showSign: true })}
          tone={overVariance ? "danger" : "success"}
        />
        <Stat label="Committed (ex GST)" value={formatCents(d.budget.committedExGstCents)} />
        <Stat label="Crew labour (inc GST)" value={formatCents(crewRollup.incGstCents)} />
        <Stat label="Mgmt cost (inc GST)" value={formatCents(mgmtRollup.incGstCents)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Checklist readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{d.checklist.pct}%</span>
              <span className="text-sm text-[var(--muted-foreground)]">
                {d.checklist.done}/{d.checklist.total} done
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${d.checklist.pct}%` }}
              />
            </div>
            <Link
              href={`/events/${id}/checklist`}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              Open checklist →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="RFQs not sent" value={d.checklist.rfqOutstanding} tone="warning" />
            <Row label="Unbooked items" value={d.checklist.unbooked} tone="warning" />
            <Row label="Booked but unpaid" value={d.checklist.unpaidBooked} tone="info" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Entries" value={d.schedule.total} />
            <Row label="Completed" value={d.schedule.completed} tone="success" />
            <Row label="Due today" value={d.schedule.dueToday} tone="info" />
            <Link
              href={`/events/${id}/schedule`}
              className="inline-block pt-1 text-sm text-[var(--primary)] hover:underline"
            >
              Open schedule →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RFQs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Outstanding" value={rfq.outstanding} tone="warning" />
            <Row label="Awaiting response" value={rfq.awaitingResponse} tone="info" />
            <Row label="Awarded" value={rfq.awarded} tone="success" />
            <Link
              href={`/events/${id}/rfqs`}
              className="inline-block pt-1 text-sm text-[var(--primary)] hover:underline"
            >
              Open RFQs →
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
        <div
          className={
            "mt-1 text-xl font-semibold " +
            (tone === "danger"
              ? "text-[var(--destructive)]"
              : tone === "success"
                ? "text-[var(--success)]"
                : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "info";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <Badge tone={tone === "default" ? "muted" : tone}>{value}</Badge>
    </div>
  );
}
