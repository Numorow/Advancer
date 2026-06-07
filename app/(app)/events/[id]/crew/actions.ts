"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { parseWorkbook } from "@/lib/import/parse";

async function patchShift(
  shiftId: string,
  eventId: string,
  patch: Record<string, unknown>,
  action: string,
) {
  const ctx = await requireContext();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("crew_shifts").update(patch as any)).eq("id", shiftId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "crew_shift",
    entityId: shiftId,
    action,
    after: patch,
  });
  revalidatePath(`/events/${eventId}/crew`);
  revalidatePath(`/events/${eventId}`);
}

const TextInput = z.object({
  shiftId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["role_name", "person", "notes", "start_time", "finish_time", "day_label"]),
  value: z.string().max(2000),
});

export async function updateCrewText(input: z.infer<typeof TextInput>) {
  const { shiftId, eventId, field, value } = TextInput.parse(input);
  const clean = value.trim() === "" ? null : value.trim();
  await patchShift(shiftId, eventId, { [field]: clean }, `edit:${field}`);
  return { ok: true };
}

const HoursInput = z.object({
  shiftId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["scheduled_hours", "actual_hours"]),
  value: z.number().min(0).max(48).nullable(),
});

export async function updateCrewHours(input: z.infer<typeof HoursInput>) {
  const { shiftId, eventId, field, value } = HoursInput.parse(input);
  await patchShift(shiftId, eventId, { [field]: value }, `edit:${field}`);
  return { ok: true };
}

const RateInput = z.object({
  shiftId: z.string().uuid(),
  eventId: z.string().uuid(),
  cents: z.number().int().min(0).max(1_000_000).nullable(),
});

export async function updateCrewRate(input: z.infer<typeof RateInput>) {
  const { shiftId, eventId, cents } = RateInput.parse(input);
  await patchShift(shiftId, eventId, { rate_cents: cents }, "edit:rate");
  return { ok: true };
}

export async function addCrewShift(input: {
  eventId: string;
  shiftDate: string | null;
  dayLabel: string | null;
}) {
  const ctx = await requireContext();
  const { eventId, shiftDate, dayLabel } = z
    .object({
      eventId: z.string().uuid(),
      shiftDate: z.string().nullable(),
      dayLabel: z.string().nullable(),
    })
    .parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crew_shifts")
    .insert({ event_id: eventId, shift_date: shiftDate, day_label: dayLabel })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add shift");
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "crew_shift",
    entityId: data.id,
    action: "create",
  });
  revalidatePath(`/events/${eventId}/crew`);
  return { id: data.id };
}

export async function removeCrewShift(input: { shiftId: string; eventId: string }) {
  const ctx = await requireContext();
  const { shiftId, eventId } = z
    .object({ shiftId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("crew_shifts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", shiftId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "crew_shift",
    entityId: shiftId,
    action: "archive",
  });
  revalidatePath(`/events/${eventId}/crew`);
  return { ok: true };
}

/** Backfill crew shifts for an already-imported event from its stored workbook. */
export async function importCrewFromWorkbook(input: { eventId: string }) {
  const ctx = await requireContext();
  const { eventId } = z.object({ eventId: z.string().uuid() }).parse(input);
  const supabase = await createClient();

  const { count } = await supabase
    .from("crew_shifts")
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
  if (!parsed.crew.length) return { created: 0 };

  const rows = parsed.crew.map((s, idx) => ({
    event_id: eventId,
    shift_date: s.shiftDate,
    day_label: s.dayLabel ?? null,
    role_name: s.role ?? null,
    start_time: s.startTime,
    finish_time: s.finishTime,
    scheduled_hours: s.scheduledHours,
    actual_hours: s.actualHours,
    rate_cents: s.rateCents,
    sort: idx,
  }));
  const { error: insErr } = await supabase.from("crew_shifts").insert(rows);
  if (insErr) return { error: insErr.message };

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "crew",
    entityId: eventId,
    action: "import_from_workbook",
    after: { created: rows.length },
  });
  revalidatePath(`/events/${eventId}/crew`);
  revalidatePath(`/events/${eventId}`);
  return { created: rows.length };
}
