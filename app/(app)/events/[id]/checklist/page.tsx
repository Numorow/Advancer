import { createClient } from "@/lib/supabase/server";
import { ChecklistGrid, type ChecklistRow } from "./checklist-grid";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase
      .from("checklist_sections")
      .select("id, name, sort")
      .eq("event_id", id)
      .order("sort", { ascending: true }),
    supabase
      .from("checklist_items")
      .select(
        "id, section_id, item, details, responsible, rfq_status, booking_status, payment_status, status, suppliers(name)",
      )
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
  ]);

  const rows: ChecklistRow[] = (items ?? []).map((i) => ({
    id: i.id,
    sectionId: i.section_id,
    item: i.item,
    details: i.details,
    responsible: i.responsible,
    supplier: (i.suppliers as unknown as { name: string } | null)?.name ?? null,
    rfq_status: i.rfq_status,
    booking_status: i.booking_status,
    payment_status: i.payment_status,
    status: i.status,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Checklist</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Click any status to advance it — RFQ, booking, payment and progress
          each cycle and are audited.
        </p>
      </div>
      <ChecklistGrid
        eventId={id}
        sections={sections ?? []}
        rows={rows}
      />
    </div>
  );
}
