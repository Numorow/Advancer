"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { parseWorkbook } from "@/lib/import/parse";
import { buildManagementRows } from "@/lib/import/infra-rows";

async function patchTask(
  taskId: string,
  eventId: string,
  patch: Record<string, unknown>,
  action: string,
) {
  const ctx = await requireContext();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("management_tasks").update(patch as any)).eq("id", taskId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "management_task",
    entityId: taskId,
    action,
    after: patch,
  });
  revalidatePath(`/events/${eventId}/management`);
  revalidatePath(`/events/${eventId}`);
}

const TextInput = z.object({
  taskId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["task", "role", "week_label"]),
  value: z.string().max(2000),
});
export async function updateManagementText(input: z.infer<typeof TextInput>) {
  const { taskId, eventId, field, value } = TextInput.parse(input);
  const clean = value.trim() === "" ? null : value.trim();
  await patchTask(taskId, eventId, { [field]: clean }, `edit:${field}`);
  return { ok: true };
}

const HoursInput = z.object({
  taskId: z.string().uuid(),
  eventId: z.string().uuid(),
  value: z.number().min(0).max(1000).nullable(),
});
export async function updateManagementHours(input: z.infer<typeof HoursInput>) {
  const { taskId, eventId, value } = HoursInput.parse(input);
  await patchTask(taskId, eventId, { hours: value }, "edit:hours");
  return { ok: true };
}

const RateInput = z.object({
  taskId: z.string().uuid(),
  eventId: z.string().uuid(),
  cents: z.number().int().min(0).max(1_000_000).nullable(),
});
export async function updateManagementRate(input: z.infer<typeof RateInput>) {
  const { taskId, eventId, cents } = RateInput.parse(input);
  await patchTask(taskId, eventId, { rate_cents: cents }, "edit:rate");
  return { ok: true };
}

const ToggleInput = z.object({
  taskId: z.string().uuid(),
  eventId: z.string().uuid(),
  value: z.boolean(),
});
export async function updateManagementCompleted(input: z.infer<typeof ToggleInput>) {
  const { taskId, eventId, value } = ToggleInput.parse(input);
  await patchTask(taskId, eventId, { completed: value }, "toggle:completed");
  return { ok: true };
}

export async function addManagementTask(input: {
  eventId: string;
  weekDate: string | null;
  weekLabel: string | null;
}) {
  const ctx = await requireContext();
  const { eventId, weekDate, weekLabel } = z
    .object({
      eventId: z.string().uuid(),
      weekDate: z.string().nullable(),
      weekLabel: z.string().nullable(),
    })
    .parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("management_tasks")
    .insert({ event_id: eventId, week_date: weekDate, week_label: weekLabel })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add task");
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "management_task",
    entityId: data.id,
    action: "create",
  });
  revalidatePath(`/events/${eventId}/management`);
  return { id: data.id };
}

export async function removeManagementTask(input: { taskId: string; eventId: string }) {
  const ctx = await requireContext();
  const { taskId, eventId } = z
    .object({ taskId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("management_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "management_task",
    entityId: taskId,
    action: "archive",
  });
  revalidatePath(`/events/${eventId}/management`);
  return { ok: true };
}

export async function importManagementFromWorkbook(input: { eventId: string }) {
  const ctx = await requireContext();
  const { eventId } = z.object({ eventId: z.string().uuid() }).parse(input);
  const supabase = await createClient();

  const { count } = await supabase
    .from("management_tasks")
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
  const rows = buildManagementRows(eventId, parsed.management);
  if (!rows.length) return { created: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (supabase as any).from("management_tasks").insert(rows);
  if (insErr) return { error: insErr.message };

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "management",
    entityId: eventId,
    action: "import_from_workbook",
    after: { created: rows.length },
  });
  revalidatePath(`/events/${eventId}/management`);
  revalidatePath(`/events/${eventId}`);
  return { created: rows.length };
}
