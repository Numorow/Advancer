import { createClient } from "@/lib/supabase/server";
import { InvoicesView, type InvoiceRow, type SupplierOpt, type BudgetLineOpt } from "./invoices-view";

type SupplierEmbed = { name: string } | null;
type CategoryEmbed = { name: string } | null;
type BudgetEmbed = { item: string | null; budget_categories: CategoryEmbed } | null;
const toNum = (v: unknown): number | null => (v == null ? null : Number(v));

export default async function InvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // Invoices table post-dates the generated Database types — read it untyped (cf. infra).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: invoices }, { data: suppliers }, { data: budgetLines }] = await Promise.all([
    sb
      .from("invoices")
      .select("*, suppliers(name), budget_items(item, budget_categories(name))")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    sb
      .from("budget_items")
      .select("id, item, budget_categories(name)")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  // Sign file paths for download/preview (private bucket, 1h — cf. documents).
  const signed = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paths = (invoices ?? []).map((i: any) => i.file_path).filter((p: unknown): p is string => Boolean(p));
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("event-docs").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: InvoiceRow[] = (invoices ?? []).map((i: any) => {
    const budget = i.budget_items as BudgetEmbed;
    return {
      id: i.id,
      kind: i.kind,
      budgetItemId: i.budget_item_id,
      budgetLabel: budget
        ? `${budget.budget_categories?.name ? `${budget.budget_categories.name} · ` : ""}${budget.item ?? "—"}`
        : null,
      supplierId: i.supplier_id,
      supplierName: (i.suppliers as SupplierEmbed)?.name ?? null,
      reference: i.reference,
      issuedDate: i.issued_date,
      dueDate: i.due_date,
      amountIncGstCents: i.amount_inc_gst_cents,
      status: i.status,
      filePath: i.file_path,
      fileUrl: i.file_path ? signed.get(i.file_path) ?? null : null,
      externalUrl: i.external_url,
      notes: i.notes,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetOpts: BudgetLineOpt[] = (budgetLines ?? []).map((b: any) => ({
    id: b.id,
    label: `${(b.budget_categories as CategoryEmbed)?.name ? `${(b.budget_categories as CategoryEmbed)!.name} · ` : ""}${b.item ?? "—"}`,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Quotes &amp; Invoices</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Store supplier quotes and invoices against budget lines. Invoices feed the line&apos;s actual cost and
          payment status; quotes are kept for reference.
        </p>
      </div>
      <InvoicesView
        eventId={id}
        invoices={rows}
        suppliers={(suppliers ?? []) as SupplierOpt[]}
        budgetLines={budgetOpts}
      />
    </div>
  );
}
