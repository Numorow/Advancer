"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { displayableImageError } from "@/lib/images";
import { applyEventTemplate } from "@/lib/templates/blank-event";
import { DEFAULT_TEMPLATE_KEY, getTemplate } from "@/lib/templates/catalog";
import { SCHEDULE_TYPES } from "@/lib/import/types";
import {
  phaseScheduleEntries,
  regenPlan,
  eventSpan,
  type PhaseInput,
} from "@/lib/templates/schedule-phases";
import type { Database } from "@/lib/db/database.types";

type ScheduleType = Database["public"]["Enums"]["schedule_type"];

const EntryInput = z.object({
  date: z.string().nullable(),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable().optional(),
  type: z.string().nullable(),
  action: z.string().nullable(),
  auto: z.boolean().optional(),
});

const PhaseRangeZ = z.object({ from: z.string().nullable(), to: z.string().nullable() });
const PhasesZ = z.object({ bumpIn: PhaseRangeZ, eventDays: PhaseRangeZ, bumpOut: PhaseRangeZ });

/** Keep only well-formed ISO dates; "" / junk → null. */
function cleanDate(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
}
function cleanPhases(p: z.infer<typeof PhasesZ>): PhaseInput {
  const r = (x: { from: string | null; to: string | null }) => ({ from: cleanDate(x.from), to: cleanDate(x.to) });
  return { bumpIn: r(p.bumpIn), eventDays: r(p.eventDays), bumpOut: r(p.bumpOut) };
}
function phaseColumns(p: PhaseInput) {
  return {
    bump_in_start: p.bumpIn.from,
    bump_in_end: p.bumpIn.to,
    event_start: p.eventDays.from,
    event_end: p.eventDays.to,
    bump_out_start: p.bumpOut.from,
    bump_out_end: p.bumpOut.to,
  };
}

export async function createEvent(input: {
  name: string;
  entries?: z.infer<typeof EntryInput>[];
  phases?: z.infer<typeof PhasesZ>;
  templateKey?: string;
}): Promise<{ eventId: string }> {
  const ctx = await requireContext();
  const name = z.string().min(1).max(200).parse(input.name).trim();
  if (ctx.role === "none" || !ctx.orgId) throw new Error("You are not a member of an organisation yet.");
  const templateKey = z.string().min(1).max(100).optional().parse(input.templateKey);
  const template = getTemplate(templateKey ?? DEFAULT_TEMPLATE_KEY);
  if (!template) throw new Error("Unknown event template.");

  const entries = (input.entries ?? [])
    .map((e) => EntryInput.parse(e))
    .filter((e) => e.date || (e.action && e.action.trim()));
  const phases = input.phases ? cleanPhases(PhasesZ.parse(input.phases)) : null;
  const dates = entries.map((e) => e.date).filter((d): d is string => Boolean(d));
  const span = phases
    ? eventSpan(phases)
    : {
        start: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null,
        end: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
      };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      org_id: ctx.orgId,
      name,
      status: "planning",
      start_date: span.start,
      end_date: span.end,
      ...(phases ? phaseColumns(phases) : {}),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create event");
  const eventId = data.id;

  await applyEventTemplate(supabase, eventId, template);

  if (entries.length) {
    const rows = entries.map((e, idx) => ({
      event_id: eventId,
      event_date: e.date,
      start_time: e.startTime || null,
      finish_time: e.finishTime || null,
      type: e.type && (SCHEDULE_TYPES as string[]).includes(e.type) ? (e.type as ScheduleType) : null,
      action: e.action?.trim() || null,
      auto_generated: e.auto ?? false,
      sort: idx,
    }));
    const { error: schErr } = await supabase.from("schedule_entries").insert(rows);
    if (schErr) throw new Error(`schedule_entries: ${schErr.message}`);
  }

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "event",
    entityId: eventId,
    action: "create",
    after: { name, template: template.key, scheduleEntries: entries.length },
  });

  revalidatePath("/");
  return { eventId };
}

/* --------------------------------------------------------- editable event dates */

export async function updateEventDates(input: {
  eventId: string;
  bumpIn: { from: string | null; to: string | null };
  eventDays: { from: string | null; to: string | null };
  bumpOut: { from: string | null; to: string | null };
}) {
  const ctx = await requireContext();
  if (ctx.role === "viewer" || ctx.role === "none") throw new Error("You don't have permission to edit this event.");
  const parsed = z
    .object({ eventId: z.string().uuid(), bumpIn: PhaseRangeZ, eventDays: PhaseRangeZ, bumpOut: PhaseRangeZ })
    .parse(input);
  const { eventId } = parsed;
  const phases = cleanPhases(parsed);
  const supabase = await createClient();

  const span = eventSpan(phases);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: evErr } = await (supabase.from("events").update({ ...phaseColumns(phases), start_date: span.start, end_date: span.end } as any)).eq("id", eventId);
  if (evErr) throw new Error(evErr.message);

  // Regenerate ONLY the auto-generated phase-day skeleton; manual rows untouched.
  const { data: existingAuto } = await supabase
    .from("schedule_entries")
    .select("id, event_date, type")
    .eq("event_id", eventId)
    .eq("auto_generated", true)
    .is("deleted_at", null);
  const desired = phaseScheduleEntries(phases);
  const plan = regenPlan(
    (existingAuto ?? []).map((e) => ({ id: e.id, date: e.event_date, type: e.type })),
    desired,
  );
  if (plan.toDeleteIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("schedule_entries").update({ deleted_at: new Date().toISOString() } as any)).in("id", plan.toDeleteIds);
  }
  if (plan.toInsert.length) {
    await supabase.from("schedule_entries").insert(
      plan.toInsert.map((d, i) => ({
        event_id: eventId,
        event_date: d.date,
        type: (SCHEDULE_TYPES as string[]).includes(d.type) ? (d.type as ScheduleType) : null,
        action: d.action,
        auto_generated: true,
        sort: 1000 + i,
      })),
    );
  }

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "event",
    entityId: eventId,
    action: "edit:dates",
    after: { ...phaseColumns(phases), regen: { deleted: plan.toDeleteIds.length, inserted: plan.toInsert.length } },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}/crew`);
  revalidatePath("/");
  return { ok: true, deleted: plan.toDeleteIds.length, inserted: plan.toInsert.length };
}

/* --------------------------------------------------------------- event image */

export async function uploadEventImage(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireContext();
  if (ctx.role === "viewer" || ctx.role === "none") return { error: "You don't have permission to edit this event." };
  const eventId = String(formData.get("eventId") ?? "");
  const file = formData.get("file");
  if (!z.string().uuid().safeParse(eventId).success) return { error: "Bad event." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  const typeError = displayableImageError(file);
  if (typeError) return { error: typeError };
  if (file.size > 10 * 1024 * 1024) return { error: "Image is over 10MB." };

  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("image_path").eq("id", eventId).maybeSingle();
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const filePath = `${eventId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("event-images")
    .upload(filePath, buffer, { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) return { error: "Upload failed." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("events").update({ image_path: filePath } as any)).eq("id", eventId);
  if (error) return { error: error.message };
  if (ev?.image_path) await supabase.storage.from("event-images").remove([ev.image_path]);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "event", entityId: eventId, action: "image:set" });
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function removeEventImage(input: { eventId: string }) {
  const ctx = await requireContext();
  if (ctx.role === "viewer" || ctx.role === "none") throw new Error("You don't have permission to edit this event.");
  const { eventId } = z.object({ eventId: z.string().uuid() }).parse(input);
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("image_path").eq("id", eventId).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("events").update({ image_path: null } as any)).eq("id", eventId);
  if (ev?.image_path) await supabase.storage.from("event-images").remove([ev.image_path]);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "event", entityId: eventId, action: "image:remove" });
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/");
  return { ok: true };
}
