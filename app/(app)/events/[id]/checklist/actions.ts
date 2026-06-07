"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

const STATUS_VALUES = {
  rfq_status: ["not_sent", "sent", "responded", "declined"],
  booking_status: ["not_booked", "tentative", "booked", "cancelled"],
  payment_status: ["unpaid", "partial", "paid"],
  status: ["not_started", "in_progress", "blocked", "done"],
} as const;

const StatusInput = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["rfq_status", "booking_status", "payment_status", "status"]),
  value: z.string(),
});

export async function updateChecklistStatus(input: z.infer<typeof StatusInput>) {
  const ctx = await requireContext();
  const { itemId, eventId, field, value } = StatusInput.parse(input);
  const allowed = STATUS_VALUES[field] as readonly string[];
  if (!allowed.includes(value)) throw new Error(`Invalid ${field} value`);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from("checklist_items").select(field) as any)
    .eq("id", itemId)
    .single();
  const oldVal = before?.[field] ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("checklist_items").update({ [field]: value } as any))
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await supabase.from("checklist_item_status_history").insert({
    item_id: itemId,
    event_id: eventId,
    field,
    old_value: oldVal,
    new_value: value,
    changed_by: ctx.userId,
  });
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "checklist_item",
    entityId: itemId,
    action: `status:${field}`,
    before: { [field]: oldVal },
    after: { [field]: value },
  });

  revalidatePath(`/events/${eventId}/checklist`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

const TextInput = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["item", "details", "responsible"]),
  value: z.string().max(2000),
});

export async function updateChecklistText(input: z.infer<typeof TextInput>) {
  const ctx = await requireContext();
  const { itemId, eventId, field, value } = TextInput.parse(input);
  const supabase = await createClient();
  const clean = value.trim() === "" ? null : value.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("checklist_items").update({ [field]: clean } as any))
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "checklist_item",
    entityId: itemId,
    action: `edit:${field}`,
    after: { [field]: clean },
  });
  revalidatePath(`/events/${eventId}/checklist`);
  return { ok: true };
}
