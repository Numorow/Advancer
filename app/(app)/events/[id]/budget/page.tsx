import { createClient } from "@/lib/supabase/server";
import { BudgetGrid, type BudgetRow } from "./budget-grid";

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, label")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("budget_categories")
      .select("id, name, sort")
      .eq("event_id", id)
      .order("sort", { ascending: true }),
    supabase
      .from("budget_items")
      .select(
        "id, category_id, item, quoted_ex_gst_cents, actual_inc_gst_cents, approval_status, payment_status, rfq_no, notes, suppliers(name)",
      )
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
  ]);

  const rows: BudgetRow[] = (items ?? []).map((i) => ({
    id: i.id,
    categoryId: i.category_id,
    item: i.item,
    supplier: (i.suppliers as unknown as { name: string } | null)?.name ?? null,
    quotedExGstCents: i.quoted_ex_gst_cents,
    actualIncGstCents: i.actual_inc_gst_cents,
    approval_status: i.approval_status,
    payment_status: i.payment_status,
    rfqNo: i.rfq_no,
    notes: i.notes,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Budget</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {version?.label ?? "Working budget"} · GST and variance recompute live
          as you edit. Click approval / payment to advance.
        </p>
      </div>
      <BudgetGrid eventId={id} categories={categories ?? []} rows={rows} />
    </div>
  );
}
