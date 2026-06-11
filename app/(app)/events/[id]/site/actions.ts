"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { displayableImageError } from "@/lib/images";

const SEVERITY = ["info", "issue", "urgent"] as const;

export async function addSiteNote(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireContext();
  const eventId = String(formData.get("eventId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const severityRaw = String(formData.get("severity") ?? "info");
  const scheduleEntryId = String(formData.get("scheduleEntryId") ?? "") || null;
  const photo = formData.get("photo");

  const parsed = z
    .object({
      eventId: z.string().uuid(),
      body: z.string().min(1).max(4000),
      severity: z.enum(SEVERITY),
      scheduleEntryId: z.string().uuid().nullable(),
    })
    .safeParse({ eventId, body, severity: severityRaw, scheduleEntryId });
  if (!parsed.success) return { error: "Please enter a note." };

  const supabase = await createClient();

  let photoPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const typeError = displayableImageError(photo);
    if (typeError) return { error: typeError };
    const ext = photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    photoPath = `${eventId}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("site-photos")
      .upload(photoPath, buffer, { contentType: photo.type || "image/jpeg", upsert: false });
    if (upErr) photoPath = null; // note still saves without the photo
  }

  const { data, error } = await supabase
    .from("site_notes")
    .insert({
      event_id: parsed.data.eventId,
      body: parsed.data.body,
      severity: parsed.data.severity,
      schedule_entry_id: parsed.data.scheduleEntryId,
      photo_path: photoPath,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save note." };

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId: parsed.data.eventId,
    actor: ctx.userId,
    entity: "site_note",
    entityId: data.id,
    action: "create",
    after: { severity: parsed.data.severity },
  });
  revalidatePath(`/events/${parsed.data.eventId}/site`);
  return { ok: true };
}

export async function resolveSiteNote(input: { noteId: string; eventId: string; resolved: boolean }) {
  const ctx = await requireContext();
  const { noteId, eventId, resolved } = z
    .object({ noteId: z.string().uuid(), eventId: z.string().uuid(), resolved: z.boolean() })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("site_notes").update({ resolved }).eq("id", noteId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "site_note",
    entityId: noteId,
    action: resolved ? "resolve" : "reopen",
  });
  revalidatePath(`/events/${eventId}/site`);
  return { ok: true };
}
