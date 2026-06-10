"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { SCHEDULE_TYPES } from "@/lib/import/types";

async function patchEntry(
  entryId: string,
  eventId: string,
  patch: Record<string, unknown>,
  action: string,
) {
  const ctx = await requireContext();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("schedule_entries").update(patch as any)).eq("id", entryId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "schedule_entry",
    entityId: entryId,
    action,
    after: patch,
  });
  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}`);
}

const ToggleInput = z.object({
  entryId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["completed", "critical_path"]),
  value: z.boolean(),
});

export async function updateScheduleToggle(input: z.infer<typeof ToggleInput>) {
  const { entryId, eventId, field, value } = ToggleInput.parse(input);
  await patchEntry(entryId, eventId, { [field]: value }, `toggle:${field}`);
  return { ok: true };
}

const TypeInput = z.object({
  entryId: z.string().uuid(),
  eventId: z.string().uuid(),
  value: z.string().nullable(),
});

export async function updateScheduleType(input: z.infer<typeof TypeInput>) {
  const { entryId, eventId, value } = TypeInput.parse(input);
  if (value !== null && !(SCHEDULE_TYPES as string[]).includes(value)) {
    throw new Error("Invalid schedule type");
  }
  await patchEntry(entryId, eventId, { type: value }, "edit:type");
  return { ok: true };
}

const TextInput = z.object({
  entryId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["action", "notes", "location", "site_poc"]),
  value: z.string().max(2000),
});

export async function updateScheduleText(input: z.infer<typeof TextInput>) {
  const { entryId, eventId, field, value } = TextInput.parse(input);
  const clean = value.trim() === "" ? null : value.trim();
  await patchEntry(entryId, eventId, { [field]: clean }, `edit:${field}`);
  return { ok: true };
}

/* ----------------------------------------------------------------- date / time */

const TimeInput = z.object({
  entryId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["start_time", "finish_time"]),
  value: z.string().nullable(),
});

export async function updateScheduleTime(input: z.infer<typeof TimeInput>) {
  const { entryId, eventId, field, value } = TimeInput.parse(input);
  // Accept "HH:MM" (Postgres `time` coerces it) or clear to null.
  const clean = value && /^\d{2}:\d{2}$/.test(value.trim()) ? value.trim() : null;
  await patchEntry(entryId, eventId, { [field]: clean }, `edit:${field}`);
  return { ok: true };
}

const DateInput = z.object({
  entryId: z.string().uuid(),
  eventId: z.string().uuid(),
  value: z.string().nullable(),
});

export async function updateScheduleDate(input: z.infer<typeof DateInput>) {
  const { entryId, eventId, value } = DateInput.parse(input);
  const clean = value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
  await patchEntry(entryId, eventId, { event_date: clean }, "edit:date");
  return { ok: true };
}

const SupplierInput = z.object({
  entryId: z.string().uuid(),
  eventId: z.string().uuid(),
  supplierId: z.string().uuid().nullable(),
});

export async function updateScheduleSupplier(input: z.infer<typeof SupplierInput>) {
  const { entryId, eventId, supplierId } = SupplierInput.parse(input);
  // Assigning a known supplier supersedes any free-text supplier name.
  const patch = supplierId
    ? { supplier_id: supplierId, supplier_text: null }
    : { supplier_id: null };
  await patchEntry(entryId, eventId, patch, "edit:supplier");
  return { ok: true };
}

/* ----------------------------------------------------------------- add / remove */

export async function addScheduleEntry(input: { eventId: string; eventDate: string | null }) {
  const ctx = await requireContext();
  const { eventId, eventDate } = z
    .object({ eventId: z.string().uuid(), eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() })
    .parse(input);
  const supabase = await createClient();

  // Append within the day: next sort after the current max for this date.
  let q = supabase.from("schedule_entries").select("sort").eq("event_id", eventId).is("deleted_at", null);
  q = eventDate ? q.eq("event_date", eventDate) : q.is("event_date", null);
  const { data: existing } = await q.order("sort", { ascending: false }).limit(1);
  const nextSort = (existing?.[0]?.sort ?? -1) + 1;

  const { data, error } = await supabase
    .from("schedule_entries")
    .insert({ event_id: eventId, event_date: eventDate, completed: false, critical_path: false, sort: nextSort })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add schedule entry");
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "schedule_entry",
    entityId: data.id,
    action: "create",
    after: { eventDate },
  });
  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}`);
  return { id: data.id };
}

export async function removeScheduleEntry(input: { entryId: string; eventId: string }) {
  const { entryId, eventId } = z
    .object({ entryId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  await patchEntry(entryId, eventId, { deleted_at: new Date().toISOString() }, "delete");
  return { ok: true };
}
