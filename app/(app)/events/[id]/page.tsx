import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/calc/money";
import { eventDashboard, rfqSummary, documentsSummary } from "@/lib/calc/dashboard";
import { estimateTotals, estimateVsBudget } from "@/lib/calc/estimate";
import { infraReadiness } from "@/lib/calc/infra";
import { rollupCrew } from "@/lib/calc/crew";
import { rollupManagement } from "@/lib/calc/management";
import type { PhaseInput } from "@/lib/templates/schedule-phases";
import { EventHero } from "./event-hero";
import { ShareLinksCard, type ShareLinkRow } from "./sharing/share-links-card";

export default async function EventDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();

  const [
    { data: checklist },
    { data: budget },
    { data: schedule },
    { data: crew },
    { data: management },
    { data: rfqs },
    { data: documents },
    { data: estimateItems },
    { data: infraPower },
    { data: infraStructures },
    { data: infraFencing },
    { data: infraFurniture },
    { data: infraToilets },
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
      .select("event_date, completed, critical_path")
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
    supabase
      .from("event_documents")
      .select("supplier_id, rfq_id, budget_item_id, schedule_entry_id")
      .eq("event_id", id)
      .is("deleted_at", null),
    supabase
      .from("estimate_items")
      .select("section, estimate_ex_gst_cents, quote_ex_gst_cents, possible_reduction_cents")
      .eq("event_id", id)
      .is("deleted_at", null),
    supabase.from("power_requirements").select("supplier_id").eq("event_id", id).is("deleted_at", null),
    supabase.from("structures").select("supplier_id, engineer_signoff").eq("event_id", id).is("deleted_at", null),
    supabase.from("fencing_requirements").select("supplier_id").eq("event_id", id).is("deleted_at", null),
    supabase.from("furniture_distribution").select("supplier_id").eq("event_id", id).is("deleted_at", null),
    supabase
      .from("toilet_calculations")
      .select("area, quantity, pans, capacity, ratio_target")
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
    (schedule ?? []).map((s) => ({ eventDate: s.event_date, completed: s.completed, criticalPath: s.critical_path })),
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

  const docs = documentsSummary(
    (documents ?? []).map((x) => ({
      hasLink: Boolean(x.supplier_id || x.rfq_id || x.budget_item_id || x.schedule_entry_id),
    })),
  );

  const estTotals = estimateTotals(
    (estimateItems ?? []).map((e) => ({
      section: e.section,
      estimateExGstCents: e.estimate_ex_gst_cents,
      quoteExGstCents: e.quote_ex_gst_cents,
      possibleReductionCents: e.possible_reduction_cents,
    })),
  );
  const estVs = estimateVsBudget(estTotals, d.budget);

  const infra = infraReadiness({
    power: (infraPower ?? []) as Record<string, unknown>[],
    structures: (infraStructures ?? []) as Record<string, unknown>[],
    fencing: (infraFencing ?? []) as Record<string, unknown>[],
    furniture: (infraFurniture ?? []) as Record<string, unknown>[],
    toilets: (infraToilets ?? []) as Record<string, unknown>[],
  });

  // Event hero — name, cover image, editable phase dates.
  const { data: event } = await supabase
    .from("events")
    .select("name, image_path, bump_in_start, bump_in_end, event_start, event_end, bump_out_start, bump_out_end")
    .eq("id", id)
    .maybeSingle();
  const phases: PhaseInput = {
    bumpIn: { from: event?.bump_in_start ?? null, to: event?.bump_in_end ?? null },
    eventDays: { from: event?.event_start ?? null, to: event?.event_end ?? null },
    bumpOut: { from: event?.bump_out_start ?? null, to: event?.bump_out_end ?? null },
  };
  let imageUrl: string | null = null;
  if (event?.image_path) {
    const { data: signed } = await supabase.storage.from("event-images").createSignedUrl(event.image_path, 3600);
    imageUrl = signed?.signedUrl ?? null;
  }
  const canEdit = ctx.role !== "viewer" && ctx.role !== "none";

  // Portal share links (+ supplier directory for the supplier-link picker).
  const [{ data: shareLinks }, { data: supplierDir }] = await Promise.all([
    supabase
      .from("event_share_links")
      .select("id, kind, token, label, created_at, expires_at, revoked_at, suppliers(name)")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
  ]);
  const shareRows: ShareLinkRow[] = (shareLinks ?? []).map((l) => ({
    id: l.id,
    kind: l.kind as "client" | "supplier",
    supplierName: (l.suppliers as unknown as { name: string } | null)?.name ?? null,
    token: l.token,
    label: l.label,
    createdAt: l.created_at,
    expiresAt: l.expires_at,
    revokedAt: l.revoked_at,
  }));

  const overVariance = d.budget.varianceCents > 0;

  return (
    <div className="space-y-6">
      <EventHero
        eventId={id}
        name={event?.name ?? "Event"}
        imageUrl={imageUrl}
        phases={phases}
        canEdit={canEdit}
      />

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
            <Row
              label="Critical path warnings"
              value={d.schedule.criticalOpen}
              tone={d.schedule.criticalOpen > 0 ? "danger" : "default"}
            />
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

        <Card>
          <CardHeader>
            <CardTitle>Estimate vs budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {estTotals.estimateIncGstCents === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No estimate lines yet.</p>
            ) : (
              <>
                <Row label="Estimate (inc GST)" value={formatCents(estTotals.estimateIncGstCents)} />
                <Row
                  label="Quoted vs estimate"
                  value={formatCents(estVs.quotedVarianceCents, { showSign: true })}
                  tone={estVs.quotedVarianceCents > 0 ? "danger" : "success"}
                />
                <Row
                  label="Actual vs estimate"
                  value={formatCents(estVs.actualVarianceCents, { showSign: true })}
                  tone={estVs.actualVarianceCents > 0 ? "danger" : "success"}
                />
              </>
            )}
            <Link
              href={`/events/${id}/estimate`}
              className="inline-block pt-1 text-sm text-[var(--primary)] hover:underline"
            >
              Open estimate →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="On file" value={docs.total} />
            <Row label="Linked to a record" value={docs.linked} tone="info" />
            <Link
              href={`/events/${id}/documents`}
              className="inline-block pt-1 text-sm text-[var(--primary)] hover:underline"
            >
              Open documents →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Infrastructure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-semibold tabular-nums">{infra.score}%</span>
              <span className="text-xs text-[var(--muted-foreground)]">readiness</span>
            </div>
            {infra.parts.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No infrastructure data yet.</p>
            ) : (
              infra.parts.map((p) => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="text-[var(--muted-foreground)]">{p.label}</span>
                  <span className="tabular-nums">{p.pct}%</span>
                </div>
              ))
            )}
            <Link
              href={`/events/${id}/infrastructure`}
              className="inline-block pt-1 text-sm text-[var(--primary)] hover:underline"
            >
              Open infrastructure →
            </Link>
          </CardContent>
        </Card>
      </section>

      {canEdit && <ShareLinksCard eventId={id} links={shareRows} suppliers={supplierDir ?? []} />}
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
  value: number | string;
  tone?: "default" | "success" | "warning" | "info" | "danger";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <Badge tone={tone === "default" ? "muted" : tone}>{value}</Badge>
    </div>
  );
}
