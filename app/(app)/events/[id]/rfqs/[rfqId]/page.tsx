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
      "id, rfq_no, title, status, location, notes, delivery_date, collection_date, response_due_date, awarded_recipient_id, budget_item_id",
    )
    .eq("id", rfqId)
    .eq("event_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!rfq) notFound();

  const [{ data: items }, { data: recipients }, { data: suppliers }, { data: event }] = await Promise.all([
    supabase.from("rfq_items").select("id, description, quantity, unit").eq("rfq_id", rfqId).order("sort"),
    supabase
      .from("rfq_recipients")
      .select(
        "id, supplier_id, status, quoted_ex_gst_cents, quote_link, notes, suppliers(name, email, contact_name)",
      )
      .eq("rfq_id", rfqId)
      .order("created_at"),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("events").select("name, organisations(name)").eq("id", id).maybeSingle(),
  ]);

  const orgName = (event?.organisations as unknown as { name: string } | null)?.name ?? "Kyron";
  const eventName = event?.name ?? "Event";

  // Itemised per-line quotes for the comparison grid.
  const recipientIds = (recipients ?? []).map((r) => r.id);
  const { data: lineQuotes } = recipientIds.length
    ? await supabase
        .from("rfq_quotes")
        .select("rfq_recipient_id, rfq_item_id, line_total_cents")
        .in("rfq_recipient_id", recipientIds)
    : { data: [] };

  // Quote attachments (private bucket → signed URLs).
  const { data: attachRows } = recipientIds.length
    ? await supabase
        .from("rfq_attachments")
        .select("id, rfq_recipient_id, label, file_path")
        .in("rfq_recipient_id", recipientIds)
        .order("created_at")
    : { data: [] };
  const attachSigned = new Map<string, string>();
  const attachPaths = (attachRows ?? []).map((a) => a.file_path);
  if (attachPaths.length) {
    const { data: urls } = await supabase.storage.from("rfq-attachments").createSignedUrls(attachPaths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) attachSigned.set(u.path, u.signedUrl);
  }

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
        orgName={orgName}
        eventName={eventName}
        rfq={{
          id: rfq.id,
          rfqNo: rfq.rfq_no,
          title: rfq.title,
          status: rfq.status,
          location: rfq.location,
          notes: rfq.notes,
          deliveryDate: rfq.delivery_date,
          collectionDate: rfq.collection_date,
          responseDueDate: rfq.response_due_date,
          awardedRecipientId: rfq.awarded_recipient_id,
        }}
        items={(items ?? []).map((i) => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
        }))}
        recipients={(recipients ?? []).map((r) => {
          const sup = r.suppliers as unknown as { name: string; email: string | null; contact_name: string | null } | null;
          return {
            id: r.id,
            supplierId: r.supplier_id,
            supplierName: sup?.name ?? "—",
            supplierEmail: sup?.email ?? null,
            supplierContactName: sup?.contact_name ?? null,
            status: r.status,
            quotedExGstCents: r.quoted_ex_gst_cents,
            quoteLink: r.quote_link,
          };
        })}
        suppliers={suppliers ?? []}
        lineQuotes={(lineQuotes ?? []).map((q) => ({
          recipientId: q.rfq_recipient_id,
          itemId: q.rfq_item_id,
          lineTotalCents: q.line_total_cents,
        }))}
        attachments={(attachRows ?? []).map((a) => ({
          id: a.id,
          recipientId: a.rfq_recipient_id,
          label: a.label ?? "File",
          url: attachSigned.get(a.file_path) ?? null,
        }))}
      />
    </div>
  );
}
