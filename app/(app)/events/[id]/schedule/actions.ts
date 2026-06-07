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
