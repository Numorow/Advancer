"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext, type SessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { deriveRfqStatus, type RfqWorkflowStatus } from "@/lib/calc/rfq";
import { ensureLinkedBudgetItem } from "@/lib/checklist/sync";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type DB = SupabaseClient<Database>;

/**
 * Recompute an RFQ's workflow status from its recipients and persist it if it
 * changed — keeps the header status honest as recipients are sent/respond,
 * without overriding the manual declined/cancelled states (see deriveRfqStatus).
 */
async function syncRfqStatus(supabase: DB, rfqId: string) {
  const { data: rfq } = await supabase
    .from("rfqs")
    .select("status, awarded_recipient_id")
    .eq("id", rfqId)
    .single();
  if (!rfq) return;
  const { data: recips } = await supabase
    .from("rfq_recipients")
    .select("status, quoted_ex_gst_cents")
    .eq("rfq_id", rfqId);
  const next = deriveRfqStatus(
    (recips ?? []).map((r) => ({ status: r.status, quotedExGstCents: r.quoted_ex_gst_cents })),
    rfq.awarded_recipient_id,
    rfq.status as RfqWorkflowStatus,
  );
  if (next !== rfq.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("rfqs").update({ status: next } as any)).eq("id", rfqId);
  }
}

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}/rfqs`);
  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}/checklist`);
  revalidatePath(`/events/${eventId}`);
}

async function audit(
  supabase: DB,
  ctx: SessionContext,
  eventId: string,
  entity: string,
  entityId: string,
  action: string,
  after?: unknown,
) {
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity,
    entityId,
    action,
    after,
  });
}

/* ---------------------------------------------------------------- create / raise */

export async function createRfq(input: { eventId: string; title: string }) {
  const ctx = await requireContext();
  const { eventId, title } = z
    .object({ eventId: z.string().uuid(), title: z.string().min(1).max(300) })
    .parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rfqs")
    .insert({ event_id: eventId, org_id: ctx.orgId, title: title.trim(), created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create RFQ");
  await audit(supabase, ctx, eventId, "rfq", data.id, "create", { title });
  revalidateEvent(eventId);
  return { rfqId: data.id };
}

export async function raiseRfqFromBudget(input: { eventId: string; budgetItemId: string }) {
  const ctx = await requireContext();
  const { eventId, budgetItemId } = z
    .object({ eventId: z.string().uuid(), budgetItemId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();

  const { data: item, error: itemErr } = await supabase
    .from("budget_items")
    .select("id, item, supplier_id, category_id, quoted_ex_gst_cents, rfq_no")
    .eq("id", budgetItemId)
    .single();
  if (itemErr || !item) throw new Error("Budget item not found");

  const { data: rfq, error } = await supabase
    .from("rfqs")
    .insert({
      event_id: eventId,
      org_id: ctx.orgId,
      title: item.item,
      rfq_no: item.rfq_no,
      budget_item_id: item.id,
      budget_category_id: item.category_id,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !rfq) throw new Error(error?.message ?? "Could not create RFQ");

  await supabase.from("rfq_items").insert({
    rfq_id: rfq.id,
    event_id: eventId,
    description: item.item,
    sort: 0,
  });
  if (item.supplier_id) {
    await supabase.from("rfq_recipients").insert({
      rfq_id: rfq.id,
      event_id: eventId,
      supplier_id: item.supplier_id,
      quoted_ex_gst_cents: item.quoted_ex_gst_cents || null,
    });
  }
  await audit(supabase, ctx, eventId, "rfq", rfq.id, "raise_from_budget", { budgetItemId });
  revalidateEvent(eventId);
  return { rfqId: rfq.id };
}

export async function raiseRfqFromChecklist(input: { eventId: string; checklistItemId: string }) {
  await requireContext();
  const { eventId, checklistItemId } = z
    .object({ eventId: z.string().uuid(), checklistItemId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  // Ensure the 1:1 budget twin exists (lazily creating it), then reuse the budget flow.
  const budgetItemId = await ensureLinkedBudgetItem(supabase, eventId, checklistItemId);
  const { rfqId } = await raiseRfqFromBudget({ eventId, budgetItemId });
  // Link the RFQ back to the checklist item so award flips it + schedule entries carry the link.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("rfqs").update({ checklist_item_id: checklistItemId } as any)).eq("id", rfqId);
  revalidateEvent(eventId);
  return { rfqId };
}

/* ------------------------------------------------------------------ rfq header */

const RfqTextInput = z.object({
  rfqId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum([
    "title",
    "location",
    "notes",
    "rfq_no",
    "delivery_date",
    "collection_date",
    "response_due_date",
  ]),
  value: z.string().max(2000).nullable(),
});

export async function updateRfqField(input: z.infer<typeof RfqTextInput>) {
  const ctx = await requireContext();
  const { rfqId, eventId, field, value } = RfqTextInput.parse(input);
  const clean = value && value.trim() !== "" ? value.trim() : null;
  if (field === "title" && !clean) throw new Error("Title is required");
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("rfqs").update({ [field]: clean } as any)).eq("id", rfqId);
  if (error) throw new Error(error.message);
  await audit(supabase, ctx, eventId, "rfq", rfqId, `edit:${field}`, { [field]: clean });
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  revalidatePath(`/events/${eventId}/rfqs`);
  return { ok: true };
}

const RFQ_STATUS = ["draft", "sent", "responded", "awarded", "declined", "cancelled"];

export async function updateRfqStatus(input: { rfqId: string; eventId: string; value: string }) {
  const ctx = await requireContext();
  const { rfqId, eventId, value } = z
    .object({ rfqId: z.string().uuid(), eventId: z.string().uuid(), value: z.string() })
    .parse(input);
  if (!RFQ_STATUS.includes(value)) throw new Error("Invalid RFQ status");
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("rfqs").update({ status: value } as any)).eq("id", rfqId);
  if (error) throw new Error(error.message);
  await audit(supabase, ctx, eventId, "rfq", rfqId, "status", { status: value });
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  revalidatePath(`/events/${eventId}/rfqs`);
  return { ok: true };
}

/* -------------------------------------------------------------------- rfq items */

export async function addRfqItem(input: { rfqId: string; eventId: string; description: string }) {
  const ctx = await requireContext();
  const { rfqId, eventId, description } = z
    .object({ rfqId: z.string().uuid(), eventId: z.string().uuid(), description: z.string().min(1).max(500) })
    .parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rfq_items")
    .insert({ rfq_id: rfqId, event_id: eventId, description: description.trim() })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add item");
  await audit(supabase, ctx, eventId, "rfq_item", data.id, "create", { description });
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  return { id: data.id };
}

export async function updateRfqItem(input: {
  itemId: string;
  rfqId: string;
  eventId: string;
  field: "description" | "quantity" | "unit";
  value: string;
}) {
  const ctx = await requireContext();
  const { itemId, rfqId, eventId, field, value } = z
    .object({
      itemId: z.string().uuid(),
      rfqId: z.string().uuid(),
      eventId: z.string().uuid(),
      field: z.enum(["description", "quantity", "unit"]),
      value: z.string().max(500),
    })
    .parse(input);
  const clean = value.trim() === "" ? (field === "description" ? value.trim() : null) : value.trim();
  if (field === "description" && !clean) throw new Error("Description is required");
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("rfq_items").update({ [field]: clean } as any)).eq("id", itemId);
  if (error) throw new Error(error.message);
  await audit(supabase, ctx, eventId, "rfq_item", itemId, `edit:${field}`, { [field]: clean });
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  return { ok: true };
}

export async function removeRfqItem(input: { itemId: string; rfqId: string; eventId: string }) {
  const ctx = await requireContext();
  const { itemId, rfqId, eventId } = z
    .object({ itemId: z.string().uuid(), rfqId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("rfq_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  await audit(supabase, ctx, eventId, "rfq_item", itemId, "delete");
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  return { ok: true };
}

/* --------------------------------------------------------------- rfq recipients */

export async function addRecipient(input: { rfqId: string; eventId: string; supplierId: string }) {
  const ctx = await requireContext();
  const { rfqId, eventId, supplierId } = z
    .object({ rfqId: z.string().uuid(), eventId: z.string().uuid(), supplierId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rfq_recipients")
    .insert({ rfq_id: rfqId, event_id: eventId, supplier_id: supplierId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add recipient");
  await audit(supabase, ctx, eventId, "rfq_recipient", data.id, "create", { supplierId });
  await syncRfqStatus(supabase, rfqId);
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  return { id: data.id };
}

export async function updateRecipientStatus(input: {
  recipientId: string;
  rfqId: string;
  eventId: string;
  value: string;
}) {
  const ctx = await requireContext();
  const { recipientId, rfqId, eventId, value } = z
    .object({
      recipientId: z.string().uuid(),
      rfqId: z.string().uuid(),
      eventId: z.string().uuid(),
      value: z.enum(["pending", "sent", "responded", "declined"]),
    })
    .parse(input);
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status: value };
  if (value === "sent") patch.sent_at = new Date().toISOString();
  if (value === "responded") patch.responded_at = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("rfq_recipients").update(patch as any)).eq("id", recipientId);
  if (error) throw new Error(error.message);
  await audit(supabase, ctx, eventId, "rfq_recipient", recipientId, "status", patch);
  await syncRfqStatus(supabase, rfqId);
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  revalidatePath(`/events/${eventId}/rfqs`);
  return { ok: true };
}

export async function updateRecipientQuote(input: {
  recipientId: string;
  rfqId: string;
  eventId: string;
  cents: number | null;
}) {
  const ctx = await requireContext();
  const { recipientId, rfqId, eventId, cents } = z
    .object({
      recipientId: z.string().uuid(),
      rfqId: z.string().uuid(),
      eventId: z.string().uuid(),
      cents: z.number().int().min(0).max(2_000_000_000).nullable(),
    })
    .parse(input);
  const supabase = await createClient();
  const patch: Record<string, unknown> = { quoted_ex_gst_cents: cents };
  if (cents !== null) {
    patch.status = "responded";
    patch.responded_at = new Date().toISOString();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("rfq_recipients").update(patch as any)).eq("id", recipientId);
  if (error) throw new Error(error.message);
  await audit(supabase, ctx, eventId, "rfq_recipient", recipientId, "quote", { cents });
  await syncRfqStatus(supabase, rfqId);
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  revalidatePath(`/events/${eventId}/rfqs`);
  return { ok: true };
}

export async function markAllRecipientsSent(input: { rfqId: string; eventId: string }) {
  const ctx = await requireContext();
  const { rfqId, eventId } = z
    .object({ rfqId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const now = new Date().toISOString();
  // Only bump the not-yet-actioned recipients; leave responded/declined as they are.
  const { error } = await supabase
    .from("rfq_recipients")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ status: "sent", sent_at: now } as any)
    .eq("rfq_id", rfqId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  await audit(supabase, ctx, eventId, "rfq", rfqId, "mark_all_sent");
  await syncRfqStatus(supabase, rfqId);
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  revalidatePath(`/events/${eventId}/rfqs`);
  return { ok: true };
}

export async function removeRecipient(input: { recipientId: string; rfqId: string; eventId: string }) {
  const ctx = await requireContext();
  const { recipientId, rfqId, eventId } = z
    .object({ recipientId: z.string().uuid(), rfqId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("rfq_recipients").delete().eq("id", recipientId);
  if (error) throw new Error(error.message);
  await audit(supabase, ctx, eventId, "rfq_recipient", recipientId, "delete");
  await syncRfqStatus(supabase, rfqId);
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  return { ok: true };
}

/* --------------------------------------------------------- itemised line quotes */

export async function upsertRfqQuote(input: {
  recipientId: string;
  itemId: string;
  rfqId: string;
  eventId: string;
  lineTotalCents: number | null;
}) {
  const ctx = await requireContext();
  const { recipientId, itemId, rfqId, eventId, lineTotalCents } = z
    .object({
      recipientId: z.string().uuid(),
      itemId: z.string().uuid(),
      rfqId: z.string().uuid(),
      eventId: z.string().uuid(),
      lineTotalCents: z.number().int().min(0).max(2_000_000_000).nullable(),
    })
    .parse(input);
  const supabase = await createClient();

  if (lineTotalCents === null) {
    await supabase
      .from("rfq_quotes")
      .delete()
      .eq("rfq_recipient_id", recipientId)
      .eq("rfq_item_id", itemId);
  } else {
    const { error } = await supabase.from("rfq_quotes").upsert(
      {
        rfq_recipient_id: recipientId,
        rfq_item_id: itemId,
        event_id: eventId,
        line_total_cents: lineTotalCents,
      },
      { onConflict: "rfq_recipient_id,rfq_item_id" },
    );
    if (error) throw new Error(error.message);
  }

  // When this recipient has any line quotes, their lump total is the SUM of the
  // lines — keep the canonical `quoted_ex_gst_cents` (used by comparison + award)
  // in lock-step. When no lines remain, leave any manually-entered lump total alone.
  const { data: lines } = await supabase
    .from("rfq_quotes")
    .select("line_total_cents")
    .eq("rfq_recipient_id", recipientId);
  const present = (lines ?? []).filter((l) => l.line_total_cents != null);
  let recipientTotalCents: number | null = null;
  if (present.length > 0) {
    recipientTotalCents = present.reduce((n, l) => n + (l.line_total_cents ?? 0), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("rfq_recipients").update({
      quoted_ex_gst_cents: recipientTotalCents,
      status: "responded",
      responded_at: new Date().toISOString(),
    } as any)).eq("id", recipientId);
  }

  await audit(supabase, ctx, eventId, "rfq_quote", recipientId, "line_quote", { itemId, lineTotalCents });
  await syncRfqStatus(supabase, rfqId);
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  return { ok: true, recipientTotalCents };
}

/* ----------------------------------------------------------- quote attachments */

export async function addRfqAttachment(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireContext();
  const recipientId = String(formData.get("recipientId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;
  const file = formData.get("file");

  const parsed = z
    .object({ recipientId: z.string().uuid(), eventId: z.string().uuid() })
    .safeParse({ recipientId, eventId });
  if (!parsed.success) return { error: "Bad recipient." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 20 * 1024 * 1024) return { error: "File is over 20MB." };

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const filePath = `${eventId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("rfq-attachments")
    .upload(filePath, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { error: "Upload failed." };

  const { data, error } = await supabase
    .from("rfq_attachments")
    .insert({ rfq_recipient_id: recipientId, event_id: eventId, label: label ?? file.name, file_path: filePath, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save attachment." };
  await audit(supabase, ctx, eventId, "rfq_attachment", data.id, "create", { label });
  revalidatePath(`/events/${eventId}/rfqs`);
  return { ok: true };
}

export async function removeRfqAttachment(input: { attachmentId: string; eventId: string }) {
  const ctx = await requireContext();
  const { attachmentId, eventId } = z
    .object({ attachmentId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { data: att } = await supabase.from("rfq_attachments").select("file_path").eq("id", attachmentId).maybeSingle();
  const { error } = await supabase.from("rfq_attachments").delete().eq("id", attachmentId);
  if (error) throw new Error(error.message);
  if (att?.file_path) await supabase.storage.from("rfq-attachments").remove([att.file_path]);
  await audit(supabase, ctx, eventId, "rfq_attachment", attachmentId, "delete");
  revalidatePath(`/events/${eventId}/rfqs`);
  return { ok: true };
}

/* -------------------------------------------------------------------- award flow */

export async function awardRfq(input: { rfqId: string; eventId: string; recipientId: string }) {
  const ctx = await requireContext();
  const { rfqId, eventId, recipientId } = z
    .object({ rfqId: z.string().uuid(), eventId: z.string().uuid(), recipientId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, rfq_no, title, location, delivery_date, collection_date, budget_item_id, checklist_item_id")
    .eq("id", rfqId)
    .single();
  const { data: recipient } = await supabase
    .from("rfq_recipients")
    .select("id, supplier_id, quoted_ex_gst_cents")
    .eq("id", recipientId)
    .single();
  if (!rfq || !recipient) throw new Error("RFQ or recipient not found");

  // 1. Mark the RFQ awarded + the winning recipient responded.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("rfqs").update({ status: "awarded", awarded_recipient_id: recipientId } as any)).eq("id", rfqId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("rfq_recipients").update({ status: "responded" } as any)).eq("id", recipientId);

  // 2. Convert to booked budget item(s).
  const budgetPatch: Record<string, unknown> = {
    approval_status: "approved",
    supplier_id: recipient.supplier_id,
  };
  if (recipient.quoted_ex_gst_cents != null) budgetPatch.quoted_ex_gst_cents = recipient.quoted_ex_gst_cents;

  if (rfq.budget_item_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("budget_items").update(budgetPatch as any)).eq("id", rfq.budget_item_id);
  } else if (rfq.rfq_no) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("budget_items").update({ approval_status: "approved", supplier_id: recipient.supplier_id } as any))
      .eq("event_id", eventId)
      .eq("rfq_no", rfq.rfq_no);
  }

  // 3. Flip the linked checklist item to booked, if any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("checklist_items").update({ booking_status: "booked", rfq_status: "responded" } as any))
    .eq("event_id", eventId)
    .eq("budget_item_id", rfq.budget_item_id ?? "00000000-0000-0000-0000-000000000000");

  // 4. Materialise delivery / collection schedule entries from the RFQ dates
  //    (idempotent — re-awarding won't duplicate an entry of the same type/date).
  const phases: { type: "DELIVERY" | "COLLECTION"; date: string | null }[] = [
    { type: "DELIVERY", date: rfq.delivery_date },
    { type: "COLLECTION", date: rfq.collection_date },
  ];
  for (const phase of phases) {
    if (!phase.date) continue;
    const { data: dupe } = await supabase
      .from("schedule_entries")
      .select("id")
      .eq("event_id", eventId)
      .eq("type", phase.type)
      .eq("event_date", phase.date)
      .eq("action", rfq.title)
      .is("deleted_at", null)
      .limit(1);
    if (dupe && dupe.length > 0) continue;
    await supabase.from("schedule_entries").insert({
      event_id: eventId,
      event_date: phase.date,
      type: phase.type,
      supplier_id: recipient.supplier_id,
      action: rfq.title,
      location: rfq.location,
      budget_item_id: rfq.budget_item_id,
      checklist_item_id: rfq.checklist_item_id,
    });
  }

  await audit(supabase, ctx, eventId, "rfq", rfqId, "award", { recipientId });
  revalidateEvent(eventId);
  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}/rfqs/${rfqId}`);
  return { ok: true };
}

/* ------------------------------------------------- backfill RFQs from the budget */

export async function generateRfqsFromBudget(input: { eventId: string }) {
  const ctx = await requireContext();
  const { eventId } = z.object({ eventId: z.string().uuid() }).parse(input);
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("budget_items")
    .select("id, item, rfq_no, supplier_id, category_id, quoted_ex_gst_cents")
    .eq("event_id", eventId)
    .not("rfq_no", "is", null)
    .is("deleted_at", null);
  const { data: existing } = await supabase
    .from("rfqs")
    .select("rfq_no")
    .eq("event_id", eventId)
    .not("rfq_no", "is", null);

  const taken = new Set((existing ?? []).map((r) => r.rfq_no));
  const groups = new Map<string, typeof items>();
  for (const it of items ?? []) {
    const key = it.rfq_no as string;
    if (taken.has(key)) continue;
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }

  let created = 0;
  for (const [rfqNo, groupItems] of groups) {
    const first = groupItems![0];
    const { data: rfq, error } = await supabase
      .from("rfqs")
      .insert({
        event_id: eventId,
        org_id: ctx.orgId,
        rfq_no: rfqNo,
        title: rfqNo,
        budget_category_id: first.category_id,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !rfq) continue;

    await supabase.from("rfq_items").insert(
      groupItems!.map((it, idx) => ({
        rfq_id: rfq.id,
        event_id: eventId,
        description: it.item,
        sort: idx,
      })),
    );

    // one recipient per distinct supplier, quoted = sum of that supplier's lines
    const bySupplier = new Map<string, number>();
    for (const it of groupItems!) {
      if (!it.supplier_id) continue;
      bySupplier.set(it.supplier_id, (bySupplier.get(it.supplier_id) ?? 0) + (it.quoted_ex_gst_cents ?? 0));
    }
    if (bySupplier.size > 0) {
      await supabase.from("rfq_recipients").insert(
        [...bySupplier.entries()].map(([supplierId, cents]) => ({
          rfq_id: rfq.id,
          event_id: eventId,
          supplier_id: supplierId,
          quoted_ex_gst_cents: cents || null,
        })),
      );
    }
    await audit(supabase, ctx, eventId, "rfq", rfq.id, "generated_from_budget", { rfqNo });
    created += 1;
  }

  revalidateEvent(eventId);
  return { created };
}
