"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

async function patchBudgetItem(
  itemId: string,
  eventId: string,
  patch: Record<string, unknown>,
  action: string,
) {
  const ctx = await requireContext();
  const supabase = await createClient();
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
