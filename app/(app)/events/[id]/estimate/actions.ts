"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { isAdminRole } from "@/lib/org/members";
import { ensureActiveBudgetVersion } from "@/lib/checklist/sync";
import { parseWorkbook } from "@/lib/import/parse";
import { buildEstimateRows } from "@/lib/import/infra-rows";

function revalidateEstimate(eventId: string) {
  revalidatePath(`/events/${eventId}/estimate`);
  revalidatePath(`/events/${eventId}`);
}

const AddInput = z.object({
  eventId: z.string().uuid(),
  section: z.string().min(1).max(200),
});

export async function addEstimateItem(input: z.infer<typeof AddInput>) {
  const ctx = await requireContext();
  const { eventId, section } = AddInput.parse(input);
  const supabase = await createClient();

  const { data: siblings } = await supabase
    .from("estimate_items")
    .select("sort")
    .eq("event_id", eventId)
    .is("deleted_at", null);
  const sort = (siblings ?? []).reduce((m, r) => Math.max(m, r.sort), -1) + 1;

  const { data, error } = await supabase
    .from("estimate_items")
    .insert({ event_id: eventId, section, description: "New line", sort })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add estimate line");

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "estimate_item",
    entityId: data.id,
    action: "create",
    after: { section },
  });
  revalidateEstimate(eventId);
  return { id: data.id };
}

const TextInput = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["description", "notes"]),
  value: z.string().max(2000),
});

export async function updateEstimateText(input: z.infer<typeof TextInput>) {
  const ctx = await requireContext();
  const { itemId, eventId, field, value } = TextInput.parse(input);
  const supabase = await createClient();
  const clean = value.trim() === "" ? null : value.trim();
  if (field === "description" && !clean) throw new Error("A description is required");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("estimate_items").update({ [field]: clean } as any)).eq("id", itemId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "estimate_item",
    entityId: itemId,
    action: `edit:${field}`,
    after: { [field]: clean },
  });
  revalidateEstimate(eventId);
  return { ok: true };
}

const MoneyInput = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["estimate_ex_gst_cents", "quote_ex_gst_cents", "possible_reduction_cents"]),
  cents: z.number().int().min(0).max(2_000_000_000).nullable(),
});

export async function updateEstimateMoney(input: z.infer<typeof MoneyInput>) {
  const ctx = await requireContext();
  const { itemId, eventId, field, cents } = MoneyInput.parse(input);
  const supabase = await createClient();
  // the estimate column is the spine of the sheet — blank means $0
  const value = field === "estimate_ex_gst_cents" ? (cents ?? 0) : cents;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("estimate_items").update({ [field]: value } as any)).eq("id", itemId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "estimate_item",
    entityId: itemId,
    action: `edit:${field}`,
    after: { [field]: value },
  });
  revalidateEstimate(eventId);
  return { ok: true };
}

export async function removeEstimateItem(input: { itemId: string; eventId: string }) {
  const ctx = await requireContext();
  const { itemId, eventId } = z
    .object({ itemId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("estimate_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "estimate_item",
    entityId: itemId,
    action: "archive",
  });
  revalidateEstimate(eventId);
  return { ok: true };
}

const LockInput = z.object({
  eventId: z.string().uuid(),
  locked: z.boolean(),
});

/** Sign-off workflow: lock/unlock the active budget version (owner/admin only). */
export async function setBudgetLock(input: z.infer<typeof LockInput>) {
  const ctx = await requireContext();
  const { eventId, locked } = LockInput.parse(input);
  if (!isAdminRole(ctx.role)) throw new Error("Only an owner or admin can lock the budget.");
  const supabase = await createClient();

  const versionId = await ensureActiveBudgetVersion(supabase, eventId);
  const { error } = await supabase
    .from("budget_versions")
    .update({ locked, updated_at: new Date().toISOString() })
    .eq("id", versionId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "budget_version",
    entityId: versionId,
    action: locked ? "lock" : "unlock",
  });
  revalidateEstimate(eventId);
  revalidatePath(`/events/${eventId}/budget`);
  return { ok: true };
}

/** Backfill the estimate from the stored workbook (skipped if any rows exist). */
export async function importEstimateFromWorkbook(input: { eventId: string }) {
  const ctx = await requireContext();
  const { eventId } = z.object({ eventId: z.string().uuid() }).parse(input);
  const supabase = await createClient();

  const { count } = await supabase
    .from("estimate_items")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) return { created: 0, skipped: true as const };

  const { data: job } = await supabase
    .from("import_jobs")
    .select("storage_path")
    .eq("event_id", eventId)
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job?.storage_path) return { error: "No stored workbook for this event." };

  const { data: blob, error: dlErr } = await supabase.storage.from("imports").download(job.storage_path);
  if (dlErr || !blob) return { error: `Could not read stored workbook: ${dlErr?.message}` };

  const parsed = await parseWorkbook(Buffer.from(await blob.arrayBuffer()));
  const rows = buildEstimateRows(eventId, parsed.estimate);
  if (!rows.length) return { created: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (supabase as any).from("estimate_items").insert(rows);
  if (insErr) return { error: insErr.message };

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "estimate",
    entityId: eventId,
    action: "import_from_workbook",
    after: { created: rows.length },
  });
  revalidateEstimate(eventId);
  return { created: rows.length };
}
