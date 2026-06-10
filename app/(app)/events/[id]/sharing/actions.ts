"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { newShareToken } from "@/lib/portal/links";

const CreateInput = z
  .object({
    eventId: z.string().uuid(),
    kind: z.enum(["client", "supplier"]),
    supplierId: z.string().uuid().nullable(),
    label: z.string().max(200).nullable(),
    expiresAt: z.string().datetime().nullable(),
  })
  .refine((v) => v.kind !== "supplier" || v.supplierId, {
    message: "A supplier link needs a supplier",
  });

export async function createShareLink(input: z.infer<typeof CreateInput>) {
  const ctx = await requireContext();
  const { eventId, kind, supplierId, label, expiresAt } = CreateInput.parse(input);
  const supabase = await createClient();

  const token = newShareToken();
  const { data, error } = await supabase
    .from("event_share_links")
    .insert({
      event_id: eventId,
      kind,
      supplier_id: kind === "supplier" ? supplierId : null,
      token,
      label,
      expires_at: expiresAt,
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
    after: { kind, supplier_id: supplierId, label },
  });
  revalidatePath(`/events/${eventId}`);
  return { id: data.id, token };
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
