"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { nextSort } from "@/lib/checklist/budget-sync";
import { removeLinkedLine, renameLine } from "@/lib/checklist/sync";

function revalidateChecklistAndBudget(eventId: string) {
  revalidatePath(`/events/${eventId}/checklist`);
  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}`);
}

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

  if (field === "item") {
    // Renaming a line renames it on both the checklist and its linked budget line.
    if (clean) await renameLine(supabase, itemId, clean);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("checklist_items").update({ [field]: clean } as any))
      .eq("id", itemId);
    if (error) throw new Error(error.message);
  }

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "checklist_item",
    entityId: itemId,
    action: `edit:${field}`,
    after: { [field]: clean },
  });
  if (field === "item") revalidateChecklistAndBudget(eventId);
  else revalidatePath(`/events/${eventId}/checklist`);
  return { ok: true };
}

const AddInput = z.object({
  eventId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

/**
 * Add a checklist item line. The budget mirrors the checklist, so this line shows
 * up on the budget immediately with blank cost columns; its budget line is created
 * lazily the first time a cost is entered. Returns the new id.
 */
export async function addChecklistItem(input: z.infer<typeof AddInput>) {
  const ctx = await requireContext();
  const { eventId, sectionId } = AddInput.parse(input);
  const supabase = await createClient();

  const { data: section } = await supabase
    .from("checklist_sections")
    .select("id, name, event_id")
    .eq("id", sectionId)
    .single();
  if (!section || section.event_id !== eventId) throw new Error("Section not found");

  const { data: siblings } = await supabase
    .from("checklist_items")
    .select("sort")
    .eq("section_id", sectionId)
    .is("deleted_at", null);
  const sort = nextSort(siblings ?? []);

  const checklist = await supabase
    .from("checklist_items")
    .insert({ section_id: sectionId, event_id: eventId, item: "New item", sort })
    .select("id")
    .single();
  if (checklist.error || !checklist.data) {
    throw new Error(checklist.error?.message ?? "Could not add checklist item");
  }

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "checklist_item",
    entityId: checklist.data.id,
    action: "create",
    after: { section: section.name },
  });
  revalidateChecklistAndBudget(eventId);
  return { id: checklist.data.id };
}

const RemoveInput = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
});

/** Soft-delete a checklist line and its linked budget line (both recoverable via deleted_at). */
export async function removeChecklistItem(input: z.infer<typeof RemoveInput>) {
  const ctx = await requireContext();
  const { itemId, eventId } = RemoveInput.parse(input);
  const supabase = await createClient();

  const { budgetItemId } = await removeLinkedLine(supabase, itemId);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "checklist_item",
    entityId: itemId,
    action: "archive",
    after: { budget_item_id: budgetItemId },
  });
  revalidateChecklistAndBudget(eventId);
  return { ok: true };
}
