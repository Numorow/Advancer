import { createClient } from "@/lib/supabase/server";
import { BudgetGrid, type BudgetRow, type UnlinkedRow } from "./budget-grid";

type SupplierEmbed = { name: string } | null;

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

  // The budget mirrors the checklist: one row per checklist item, grouped by section.
  // Cost data lives on the linked budget_item (created lazily); imported budget lines
  // with no checklist twin are surfaced separately so nothing is hidden.
  const [{ data: sections }, { data: checklistItems }, { data: budgetItems }, { data: suppliers }] =
    await Promise.all([
      supabase
        .from("checklist_sections")
        .select("id, name, sort")
        .eq("event_id", id)
        .order("sort", { ascending: true }),
      supabase
        .from("checklist_items")
        .select("id, section_id, item, budget_item_id, supplier_id, suppliers(name)")
        .eq("event_id", id)
        .is("deleted_at", null)
        .order("sort", { ascending: true }),
      supabase
        .from("budget_items")
        .select(
          "id, item, quoted_ex_gst_cents, actual_inc_gst_cents, approval_status, payment_status, rfq_no, supplier_id, suppliers(name), budget_categories(name)",
        )
        .eq("event_id", id)
        .is("deleted_at", null),
      supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    ]);

  const budgetById = new Map((budgetItems ?? []).map((b) => [b.id, b]));
  const linkedIds = new Set<string>();

  const rows: BudgetRow[] = (checklistItems ?? []).map((ci) => {
    const b = ci.budget_item_id ? budgetById.get(ci.budget_item_id) : null;
    if (b) linkedIds.add(b.id);
    return {
      checklistItemId: ci.id,
      sectionId: ci.section_id,
      budgetItemId: b?.id ?? null,
      item: ci.item,
      supplierId: b?.supplier_id ?? ci.supplier_id ?? null,
      supplier:
        (b?.suppliers as unknown as SupplierEmbed)?.name ??
        (ci.suppliers as unknown as SupplierEmbed)?.name ??
        null,
      quotedExGstCents: b?.quoted_ex_gst_cents ?? 0,
      actualIncGstCents: b?.actual_inc_gst_cents ?? 0,
      approval_status: b?.approval_status ?? "pending",
      payment_status: b?.payment_status ?? "unpaid",
      rfqNo: b?.rfq_no ?? null,
    };
  });

  const unlinked: UnlinkedRow[] = (budgetItems ?? [])
    .filter((b) => !linkedIds.has(b.id))
    .map((b) => ({
      budgetItemId: b.id,
      item: b.item,
      category: (b.budget_categories as unknown as { name: string } | null)?.name ?? null,
      supplierId: b.supplier_id,
      supplier: (b.suppliers as unknown as SupplierEmbed)?.name ?? null,
      quotedExGstCents: b.quoted_ex_gst_cents,
      actualIncGstCents: b.actual_inc_gst_cents,
      approval_status: b.approval_status,
      payment_status: b.payment_status,
      rfqNo: b.rfq_no,
    }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Budget</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {version?.label ?? "Working budget"} · mirrors the checklist — add costs against
          each item. GST and variance recompute live; click approval / payment to advance.
        </p>
      </div>
      <BudgetGrid
        eventId={id}
        sections={sections ?? []}
        rows={rows}
        unlinked={unlinked}
        suppliers={suppliers ?? []}
      />
    </div>
  );
}
