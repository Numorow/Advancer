"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { applyBlankTemplate } from "@/lib/templates/blank-event";
import { SCHEDULE_TYPES } from "@/lib/import/types";
import type { Database } from "@/lib/db/database.types";

type ScheduleType = Database["public"]["Enums"]["schedule_type"];

const EntryInput = z.object({
  date: z.string().nullable(),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable().optional(),
  type: z.string().nullable(),
  action: z.string().nullable(),
});

export async function createEvent(input: {
  name: string;
  entries?: z.infer<typeof EntryInput>[];
}): Promise<{ eventId: string }> {
  const ctx = await requireContext();
  const name = z.string().min(1).max(200).parse(input.name).trim();
  if (ctx.role === "none" || !ctx.orgId) throw new Error("You are not a member of an organisation yet.");

  const entries = (input.entries ?? [])
    .map((e) => EntryInput.parse(e))
    .filter((e) => e.date || (e.action && e.action.trim()));
  const dates = entries.map((e) => e.date).filter((d): d is string => Boolean(d));
  const startDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const endDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      org_id: ctx.orgId,
      name,
      status: "planning",
      start_date: startDate,
      end_date: endDate,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create event");
  const eventId = data.id;

  await applyBlankTemplate(supabase, eventId);

  if (entries.length) {
    const rows = entries.map((e, idx) => ({
      event_id: eventId,
      event_date: e.date,
      start_time: e.startTime || null,
      finish_time: e.finishTime || null,
      type: e.type && (SCHEDULE_TYPES as string[]).includes(e.type) ? (e.type as ScheduleType) : null,
      action: e.action?.trim() || null,
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
    after: { name, template: "blank", scheduleEntries: entries.length },
  });

  revalidatePath("/");
  return { eventId };
}
