"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { assertBudgetUnlocked, ensureLinkedBudgetItem } from "@/lib/checklist/sync";

/**
 * Lazily materialise the budget line for a checklist item (created on first cost
 * entry). Returns its id so the client can target subsequent money/status edits.
 */
export async function ensureBudgetItem(input: { eventId: string; checklistItemId: string }) {
  await requireContext();
  const { eventId, checklistItemId } = z
    .object({ eventId: z.string().uuid(), checklistItemId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const budgetItemId = await ensureLinkedBudgetItem(supabase, eventId, checklistItemId);
  revalidatePath(`/events/${eventId}/budget`);
  return { budgetItemId };
}

const RemoveBudgetOnly = z.object({
  eventId: z.string().uuid(),
  budgetItemId: z.string().uuid(),
});

/** Soft-delete a budget line that has no checklist twin (the imported/unlinked group). */
export async function removeBudgetItemOnly(input: z.infer<typeof RemoveBudgetOnly>) {
  const ctx = await requireContext();
  const { eventId, budgetItemId } = RemoveBudgetOnly.parse(input);
  const supabase = await createClient();
  await assertBudgetUnlocked(supabase, eventId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("budget_items").update({ deleted_at: new Date().toISOString() } as any)).eq("id", budgetItemId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "budget_item",
    entityId: budgetItemId,
    action: "archive",
  });
  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

async function patchBudgetItem(
  itemId: string,
  eventId: string,
  patch: Record<string, unknown>,
  action: string,
) {
  const ctx = await requireContext();
  const supabase = await createClient();
  await assertBudgetUnlocked(supabase, eventId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("budget_items").update(patch as any)).eq("id", itemId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "budget_item",
    entityId: itemId,
    action,
    after: patch,
  });
  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}`);
}

const MoneyInput = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["quoted_ex_gst_cents", "actual_inc_gst_cents"]),
  cents: z.number().int().min(0).max(2_000_000_000),
});

export async function updateBudgetMoney(input: z.infer<typeof MoneyInput>) {
  const { itemId, eventId, field, cents } = MoneyInput.parse(input);
  await patchBudgetItem(itemId, eventId, { [field]: cents }, `edit:${field}`);
  return { ok: true };
}

const StatusInput = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["approval_status", "payment_status"]),
  value: z.string(),
});

const STATUS_VALUES = {
  approval_status: ["pending", "approved", "rejected"],
  payment_status: ["unpaid", "partial", "paid"],
} as const;

export async function updateBudgetStatus(input: z.infer<typeof StatusInput>) {
  const { itemId, eventId, field, value } = StatusInput.parse(input);
  if (!(STATUS_VALUES[field] as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${field}`);
  }
  await patchBudgetItem(itemId, eventId, { [field]: value }, `status:${field}`);
  return { ok: true };
}

const TextInput = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["item", "notes", "rfq_no"]),
  value: z.string().max(2000),
});

export async function updateBudgetText(input: z.infer<typeof TextInput>) {
  const { itemId, eventId, field, value } = TextInput.parse(input);
  const clean = value.trim() === "" ? null : value.trim();
  await patchBudgetItem(itemId, eventId, { [field]: clean }, `edit:${field}`);
  return { ok: true };
}

const SupplierInput = z
  .object({
    eventId: z.string().uuid(),
    supplierId: z.string().uuid().nullable(),
    checklistItemId: z.string().uuid().optional(),
    budgetItemId: z.string().uuid().optional(),
  })
  .refine((i) => !!i.checklistItemId !== !!i.budgetItemId, {
    message: "Provide exactly one of checklistItemId / budgetItemId",
  });

/**
 * Assign (or clear) the supplier on a budget row. Supplier is checklist-owned
 * metadata, so for mirror rows we follow the renameLine precedent: update the
 * checklist item first, then patch the budget twin when one exists — without a
 * budget-lock check (awardRfq already writes supplier_id while locked) and
 * without materialising a twin (ensureLinkedBudgetItem copies supplier_id
 * whenever the twin is created later).
 */
export async function setItemSupplier(input: z.infer<typeof SupplierInput>) {
  const ctx = await requireContext();
  const { eventId, supplierId, checklistItemId, budgetItemId } = SupplierInput.parse(input);
  const supabase = await createClient();

  if (supplierId) {
    const { data: sup } = await supabase
      .from("suppliers")
      .select("id")
      .eq("id", supplierId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!sup) throw new Error("Supplier not found");
  }

  let entity: "checklist_item" | "budget_item";
  let entityId: string;
  if (checklistItemId) {
    const { error } = await supabase
      .from("checklist_items")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ supplier_id: supplierId } as any)
      .eq("id", checklistItemId);
    if (error) throw new Error(error.message);
    const { data: ci } = await supabase
      .from("checklist_items")
      .select("budget_item_id")
      .eq("id", checklistItemId)
      .single();
    if (ci?.budget_item_id) {
      await supabase.from("budget_items").update({ supplier_id: supplierId }).eq("id", ci.budget_item_id);
    }
    entity = "checklist_item";
    entityId = checklistItemId;
  } else {
    const { error } = await supabase
      .from("budget_items")
      .update({ supplier_id: supplierId })
      .eq("id", budgetItemId!);
    if (error) throw new Error(error.message);
    entity = "budget_item";
    entityId = budgetItemId!;
  }

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity,
    entityId,
    action: "edit:supplier",
    after: { supplier_id: supplierId },
  });
  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}/checklist`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}
