import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RfqEditor } from "./rfq-editor";

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string; rfqId: string }>;
}) {
  const { id, rfqId } = await params;
  const supabase = await createClient();

  const { data: rfq } = await supabase
    .from("rfqs")
    .select(
      "id, rfq_no, title, status, location, notes, delivery_date, collection_date, awarded_recipient_id, budget_item_id",
    )
    .eq("id", rfqId)
    .eq("event_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!rfq) notFound();

  const [{ data: items }, { data: recipients }, { data: suppliers }] = await Promise.all([
    supabase.from("rfq_items").select("id, description, quantity, unit").eq("rfq_id", rfqId).order("sort"),
    supabase
      .from("rfq_recipients")
      .select("id, supplier_id, status, quoted_ex_gst_cents, quote_link, notes, suppliers(name)")
      .eq("rfq_id", rfqId)
      .order("created_at"),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Link href={`/events/${id}/rfqs`} className="hover:underline">
          RFQs
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{rfq.rfq_no ?? rfq.title}</span>
      </div>

      <RfqEditor
        eventId={id}
        rfq={{
          id: rfq.id,
          rfqNo: rfq.rfq_no,
          title: rfq.title,
          status: rfq.status,
          location: rfq.location,
          notes: rfq.notes,
          deliveryDate: rfq.delivery_date,
          collectionDate: rfq.collection_date,
          awardedRecipientId: rfq.awarded_recipient_id,
        }}
        items={(items ?? []).map((i) => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
        }))}
        recipients={(recipients ?? []).map((r) => ({
          id: r.id,
          supplierId: r.supplier_id,
          supplierName: (r.suppliers as unknown as { name: string } | null)?.name ?? "—",
          status: r.status,
          quotedExGstCents: r.quoted_ex_gst_cents,
          quoteLink: r.quote_link,
        }))}
        suppliers={suppliers ?? []}
      />
    </div>
  );
}
