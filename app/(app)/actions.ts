"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { applyBlankTemplate } from "@/lib/templates/blank-event";

export async function createEvent(input: { name: string }): Promise<{ eventId: string }> {
  const ctx = await requireContext();
  const name = z.string().min(1).max(200).parse(input.name).trim();
  if (ctx.role === "none" || !ctx.orgId) throw new Error("You are not a member of an organisation yet.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ org_id: ctx.orgId, name, status: "planning", created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create event");

  await applyBlankTemplate(supabase, data.id);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId: data.id,
    actor: ctx.userId,
    entity: "event",
    entityId: data.id,
    action: "create",
    after: { name, template: "blank" },
  });

  revalidatePath("/");
  return { eventId: data.id };
}
