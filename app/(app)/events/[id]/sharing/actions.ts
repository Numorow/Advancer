"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { defaultShareExpiry, newShareToken } from "@/lib/portal/links";

const CreateInput = z
  .object({
    eventId: z.string().uuid(),
    kind: z.enum(["client", "supplier"]),
    supplierId: z.string().uuid().nullable(),
    label: z.string().max(200).nullable(),
    expiresAt: z.string().datetime().nullable(),
    /** Explicit opt-out — otherwise links default to a 90-day expiry. */
    noExpiry: z.boolean().optional(),
  })
  .refine((v) => v.kind !== "supplier" || v.supplierId, {
    message: "A supplier link needs a supplier",
  });

export async function createShareLink(input: z.infer<typeof CreateInput>) {
  const ctx = await requireContext();
  const { eventId, kind, supplierId, label, expiresAt, noExpiry } = CreateInput.parse(input);
  const supabase = await createClient();

  const expiry = noExpiry ? null : (expiresAt ?? defaultShareExpiry(new Date().toISOString()));
  const token = newShareToken();
  const { data, error } = await supabase
    .from("event_share_links")
    .insert({
      event_id: eventId,
      kind,
      supplier_id: kind === "supplier" ? supplierId : null,
      token,
      label,
      expires_at: expiry,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create link");

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "share_link",
    entityId: data.id,
    action: "create",
    after: { kind, supplier_id: supplierId, label, expires_at: expiry },
  });
  revalidatePath(`/events/${eventId}`);
  return { id: data.id, token };
}

export async function updateShareLinkExpiry(input: {
  linkId: string;
  eventId: string;
  expiresAt: string | null;
}) {
  const ctx = await requireContext();
  const { linkId, eventId, expiresAt } = z
    .object({
      linkId: z.string().uuid(),
      eventId: z.string().uuid(),
      expiresAt: z.string().datetime().nullable(),
    })
    .parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("event_share_links")
    .update({ expires_at: expiresAt })
    .eq("id", linkId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "share_link",
    entityId: linkId,
    action: "edit:expires_at",
    after: { expires_at: expiresAt },
  });
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function revokeShareLink(input: { linkId: string; eventId: string }) {
  const ctx = await requireContext();
  const { linkId, eventId } = z
    .object({ linkId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("event_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "share_link",
    entityId: linkId,
    action: "revoke",
  });
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}
