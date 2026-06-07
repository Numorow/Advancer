import { createClient } from "@/lib/supabase/server";
import { compareQuotes } from "@/lib/calc/rfq";
import { RfqsList, type RfqListRow } from "./rfqs-list";

export default async function RfqsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rfqs } = await supabase
    .from("rfqs")
    .select(
      "id, rfq_no, title, status, delivery_date, collection_date, rfq_recipients(id, quoted_ex_gst_cents)",
    )
    .eq("event_id", id)
    .is("deleted_at", null)
    .order("rfq_no", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const rows: RfqListRow[] = (rfqs ?? []).map((r) => {
    const recipients = (r.rfq_recipients as unknown as { id: string; quoted_ex_gst_cents: number | null }[]) ?? [];
    const cmp = compareQuotes(recipients.map((x) => ({ id: x.id, quotedExGstCents: x.quoted_ex_gst_cents })));
    return {
      id: r.id,
      rfqNo: r.rfq_no,
      title: r.title,
      status: r.status,
      deliveryDate: r.delivery_date,
      collectionDate: r.collection_date,
      recipients: recipients.length,
      bestCents: cmp.bestCents,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">RFQs</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Raise requests for quote, compare supplier responses, and award —
          awarding books the budget line.
        </p>
      </div>
      <RfqsList eventId={id} rows={rows} />
    </div>
  );
}
