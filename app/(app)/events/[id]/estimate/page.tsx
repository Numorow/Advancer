import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { isAdminRole } from "@/lib/org/members";
import { rollupBudget } from "@/lib/calc/budget";
import { EstimateView, type EstimateRow } from "./estimate-view";

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await getSessionContext();

  const [{ data: items }, { data: budgetItems }, { data: version }] = await Promise.all([
    supabase
      .from("estimate_items")
      .select("id, section, description, estimate_ex_gst_cents, quote_ex_gst_cents, possible_reduction_cents, notes, sort")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
    supabase
      .from("budget_items")
      .select("quoted_ex_gst_cents, actual_inc_gst_cents")
      .eq("event_id", id)
      .is("deleted_at", null),
    supabase
      .from("budget_versions")
      .select("locked")
      .eq("event_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows: EstimateRow[] = (items ?? []).map((i) => ({
    id: i.id,
    section: i.section,
    description: i.description,
    estimateExGstCents: i.estimate_ex_gst_cents,
    quoteExGstCents: i.quote_ex_gst_cents,
    possibleReductionCents: i.possible_reduction_cents,
    notes: i.notes,
  }));

  const budget = rollupBudget(
    (budgetItems ?? []).map((b) => ({
      quotedExGstCents: b.quoted_ex_gst_cents,
      actualIncGstCents: b.actual_inc_gst_cents,
    })),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Estimate</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          The high-level event estimate, compared against the working budget&apos;s quoted and
          actual totals. Lock the budget here once it&apos;s signed off.
        </p>
      </div>
      <EstimateView
        eventId={id}
        rows={rows}
        budgetQuotedIncGstCents={budget.quotedIncGstCents}
        budgetActualIncGstCents={budget.actualIncGstCents}
        locked={version?.locked ?? false}
        canLock={isAdminRole(ctx?.role ?? "none")}
      />
    </div>
  );
}
