import type { NextRequest } from "next/server";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toRfqPdf } from "@/lib/rfq/pdf";
import { ADVANCER_MARK, loadEventImage } from "@/lib/reports/branding";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "rfq";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rfqId: string }> },
) {
  const ctx = await requireContext();
  const { id, rfqId } = await params;
  const recipientId = req.nextUrl.searchParams.get("recipient");
  const supabase = await createClient();

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("rfq_no, title, delivery_date, collection_date, response_due_date, location, notes")
    .eq("id", rfqId)
    .eq("event_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!rfq) return new Response("RFQ not found", { status: 404 });

  const [{ data: items }, { data: event }, { data: org }] = await Promise.all([
    supabase.from("rfq_items").select("description, quantity, unit").eq("rfq_id", rfqId).order("sort"),
    supabase.from("events").select("name, image_path").eq("id", id).maybeSingle(),
    supabase.from("organisations").select("name").eq("id", ctx.orgId).maybeSingle(),
  ]);

  let recipient: { supplierName: string; contactName: string | null } | null = null;
  if (recipientId) {
    const { data: r } = await supabase
      .from("rfq_recipients")
      .select("suppliers(name, contact_name)")
      .eq("id", recipientId)
      .eq("rfq_id", rfqId)
      .maybeSingle();
    const sup = r?.suppliers as unknown as { name: string; contact_name: string | null } | null;
    if (sup) recipient = { supplierName: sup.name, contactName: sup.contact_name };
  }

  const buf = await toRfqPdf({
    rfq: {
      rfqNo: rfq.rfq_no,
      title: rfq.title,
      deliveryDate: rfq.delivery_date,
      collectionDate: rfq.collection_date,
      responseDueDate: rfq.response_due_date,
      location: rfq.location,
      notes: rfq.notes,
    },
    items: (items ?? []).map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit })),
    recipient,
    orgName: org?.name ?? "Kyron",
    eventName: event?.name ?? "Event",
    branding: { mark: ADVANCER_MARK, eventImage: await loadEventImage(supabase, event?.image_path) },
  });

  const filename = `${slug(rfq.rfq_no ?? rfq.title)}-rfq.pdf`;
  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
