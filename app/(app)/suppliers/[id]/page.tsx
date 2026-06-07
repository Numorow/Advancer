import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/calc/money";
import { statusMeta } from "@/lib/status";
import { SupplierDetailForm } from "./supplier-detail";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireContext();
  const { id } = await params;
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name, contact_name, email, phone, abn, notes, insurance, preferred, service_categories")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!supplier) notFound();

  const [budget, checklist, schedule, rfq] = await Promise.all([
    supabase
      .from("budget_items")
      .select("id, item, quoted_ex_gst_cents, budget_categories(name)")
      .eq("supplier_id", id)
      .is("deleted_at", null),
    supabase.from("checklist_items").select("id, item").eq("supplier_id", id).is("deleted_at", null),
    supabase.from("schedule_entries").select("id, action, event_date").eq("supplier_id", id).is("deleted_at", null),
    supabase
      .from("rfq_recipients")
      .select("id, status, quoted_ex_gst_cents, rfqs(id, rfq_no, title, status)")
      .eq("supplier_id", id),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Link href="/suppliers" className="hover:underline">
          Suppliers
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{supplier.name}</span>
        {supplier.preferred && <Badge tone="info">preferred</Badge>}
      </div>

      <SupplierDetailForm
        supplier={{
          id: supplier.id,
          name: supplier.name,
          contact_name: supplier.contact_name,
          email: supplier.email,
          phone: supplier.phone,
          abn: supplier.abn,
          notes: supplier.notes,
          insurance: supplier.insurance,
          preferred: supplier.preferred,
          categories: (supplier.service_categories ?? []).join(", "),
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <WhereUsed title={`Budget items (${budget.data?.length ?? 0})`}>
          {(budget.data ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-1">
              <span className="truncate">
                {b.item}
                <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                  {(b.budget_categories as unknown as { name: string } | null)?.name}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-[var(--muted-foreground)]">
                {formatCents(b.quoted_ex_gst_cents)}
              </span>
            </li>
          ))}
        </WhereUsed>

        <WhereUsed title={`Checklist items (${checklist.data?.length ?? 0})`}>
          {(checklist.data ?? []).map((c) => (
            <li key={c.id} className="truncate py-1">
              {c.item}
            </li>
          ))}
        </WhereUsed>

        <WhereUsed title={`Schedule entries (${schedule.data?.length ?? 0})`}>
          {(schedule.data ?? []).map((s) => (
            <li key={s.id} className="flex justify-between gap-2 py-1">
              <span className="truncate">{s.action ?? "—"}</span>
              <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{s.event_date ?? ""}</span>
            </li>
          ))}
        </WhereUsed>

        <WhereUsed title={`RFQ history (${rfq.data?.length ?? 0})`}>
          {(rfq.data ?? []).map((r) => {
            const parent = r.rfqs as unknown as {
              id: string;
              rfq_no: string | null;
              title: string;
              status: string;
            } | null;
            const meta = statusMeta("rfq_recipient", r.status);
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 py-1">
                <span className="truncate">
                  {parent?.rfq_no ? `${parent.rfq_no} · ` : ""}
                  {parent?.title}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.quoted_ex_gst_cents != null && (
                    <span className="tabular-nums text-[var(--muted-foreground)]">
                      {formatCents(r.quoted_ex_gst_cents)}
                    </span>
                  )}
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </span>
              </li>
            );
          })}
        </WhereUsed>
      </div>
    </div>
  );
}

function WhereUsed({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">None.</p>
        ) : (
          <ul className="divide-y text-sm">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}
