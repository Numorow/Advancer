"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { nextSort } from "@/lib/checklist/budget-sync";

function revalidateContacts(eventId: string) {
  revalidatePath(`/events/${eventId}/contacts`);
  revalidatePath(`/events/${eventId}/site`);
}

const AddInput = z.object({ eventId: z.string().uuid() });

export async function addEventContact(input: z.infer<typeof AddInput>) {
  const ctx = await requireContext();
  const { eventId } = AddInput.parse(input);
  const supabase = await createClient();

  const { data: siblings } = await supabase
    .from("event_contacts")
    .select("sort")
    .eq("event_id", eventId);
  const sort = nextSort(siblings ?? []);

  const { data, error } = await supabase
    .from("event_contacts")
    .insert({ event_id: eventId, sort })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add contact");

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "event_contact",
    entityId: data.id,
    action: "create",
  });
  revalidateContacts(eventId);
  return { id: data.id };
}

const TextInput = z.object({
  contactId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["position", "name", "company", "mobile", "email"]),
  value: z.string().max(2000),
});

export async function updateEventContact(input: z.infer<typeof TextInput>) {
  const ctx = await requireContext();
  const { contactId, eventId, field, value } = TextInput.parse(input);
  const supabase = await createClient();
  const clean = value.trim() === "" ? null : value.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("event_contacts").update({ [field]: clean } as any))
    .eq("id", contactId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "event_contact",
    entityId: contactId,
    action: `edit:${field}`,
    after: { [field]: clean },
  });
  revalidateContacts(eventId);
  return { ok: true };
}

const RemoveInput = z.object({
  contactId: z.string().uuid(),
  eventId: z.string().uuid(),
});

export async function removeEventContact(input: z.infer<typeof RemoveInput>) {
  const ctx = await requireContext();
  const { contactId, eventId } = RemoveInput.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("event_contacts").delete().eq("id", contactId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "event_contact",
    entityId: contactId,
    action: "delete",
  });
  revalidateContacts(eventId);
  return { ok: true };
}

const BillingInput = z.object({
  eventId: z.string().uuid(),
  field: z.enum(["approver", "responsible", "billing_entity", "abn", "address", "notes"]),
  value: z.string().max(4000),
});

/** Billing profile is a single row per event, created lazily on first edit. */
export async function updateBillingProfile(input: z.infer<typeof BillingInput>) {
  const ctx = await requireContext();
  const { eventId, field, value } = BillingInput.parse(input);
  const supabase = await createClient();
  const clean = value.trim() === "" ? null : value.trim();

  const { data: existing } = await supabase
    .from("event_billing_profiles")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    const { error } = await (
      supabase
        .from("event_billing_profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ [field]: clean, updated_at: new Date().toISOString() } as any)
    ).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("event_billing_profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ event_id: eventId, [field]: clean } as any);
    if (error) throw new Error(error.message);
  }

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "event_billing",
    entityId: eventId,
    action: `edit:${field}`,
    after: { [field]: clean },
  });
  revalidatePath(`/events/${eventId}/contacts`);
  return { ok: true };
}
