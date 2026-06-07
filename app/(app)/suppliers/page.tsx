import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SuppliersGrid, type SupplierRow } from "./suppliers-grid";

export default async function SuppliersPage() {
  await requireContext();
  const supabase = await createClient();

  const [{ data: suppliers }, budget, checklist, schedule, rfq] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, contact_name, email, phone, abn, insurance, preferred, service_categories")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase.from("budget_items").select("supplier_id").not("supplier_id", "is", null),
    supabase.from("checklist_items").select("supplier_id").not("supplier_id", "is", null),
    supabase.from("schedule_entries").select("supplier_id").not("supplier_id", "is", null),
    supabase.from("rfq_recipients").select("supplier_id").not("supplier_id", "is", null),
  ]);

  const usedBy = new Map<string, number>();
  for (const list of [budget.data, checklist.data, schedule.data, rfq.data]) {
    for (const r of list ?? []) {
      const id = (r as { supplier_id: string | null }).supplier_id;
      if (id) usedBy.set(id, (usedBy.get(id) ?? 0) + 1);
    }
  }

  const rows: SupplierRow[] = (suppliers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    contact_name: s.contact_name,
    email: s.email,
    phone: s.phone,
    abn: s.abn,
    insurance: s.insurance,
    preferred: s.preferred,
    categories: (s.service_categories ?? []).join(", "),
    usedBy: usedBy.get(s.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Suppliers</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your organisation&apos;s supplier directory — shared across every event.
        </p>
      </div>
      <SuppliersGrid rows={rows} />
    </div>
  );
}
