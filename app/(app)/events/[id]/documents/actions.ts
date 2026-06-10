"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

const uuidOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Invalid id");

export async function addEventDocument(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireContext();
  const eventId = String(formData.get("eventId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const externalUrl = String(formData.get("externalUrl") ?? "").trim() || null;
  const file = formData.get("file");

  const parsed = z
    .object({
      eventId: z.string().uuid(),
      title: z.string().min(1).max(300),
      supplierId: uuidOrNull,
      rfqId: uuidOrNull,
    })
    .safeParse({
      eventId,
      title,
      supplierId: String(formData.get("supplierId") ?? ""),
      rfqId: String(formData.get("rfqId") ?? ""),
    });
  if (!parsed.success) return { error: "A document title is required." };

  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !externalUrl) return { error: "Attach a file or paste a link." };
  if (externalUrl && !/^https?:\/\//i.test(externalUrl)) return { error: "Links must start with http(s)://." };

  const supabase = await createClient();

  let filePath: string | null = null;
  if (hasFile) {
    const f = file as File;
    if (f.size > 20 * 1024 * 1024) return { error: "File is over 20MB." };
    const ext = f.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    filePath = `${eventId}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("event-docs")
      .upload(filePath, buffer, { contentType: f.type || "application/octet-stream", upsert: false });
    if (upErr) return { error: "Upload failed." };
  }

  const { data, error } = await supabase
    .from("event_documents")
    .insert({
      event_id: parsed.data.eventId,
      org_id: ctx.orgId,
      title: parsed.data.title,
      category,
      file_path: filePath,
      external_url: hasFile ? null : externalUrl,
      supplier_id: parsed.data.supplierId,
      rfq_id: parsed.data.rfqId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save document." };

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId: parsed.data.eventId,
    actor: ctx.userId,
    entity: "event_document",
    entityId: data.id,
    action: "create",
    after: { title: parsed.data.title, category },
  });
  revalidatePath(`/events/${parsed.data.eventId}/documents`);
  revalidatePath(`/events/${parsed.data.eventId}`);
  return { ok: true };
}

const FieldInput = z.object({
  docId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["title", "category", "supplier_id", "rfq_id"]),
  value: z.string().max(300).nullable(),
});

export async function updateEventDocumentField(input: z.infer<typeof FieldInput>) {
  const ctx = await requireContext();
  const { docId, eventId, field, value } = FieldInput.parse(input);
  let clean: string | null = value && value.trim() !== "" ? value.trim() : null;
  if (field === "title" && !clean) throw new Error("Title is required");
  if ((field === "supplier_id" || field === "rfq_id") && clean && !z.string().uuid().safeParse(clean).success) {
    throw new Error("Invalid link");
  }
  if (field === "supplier_id" || field === "rfq_id") clean = clean ?? null;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("event_documents").update({ [field]: clean } as any)).eq("id", docId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "event_document", entityId: docId, action: `edit:${field}`, after: { [field]: clean } });
  revalidatePath(`/events/${eventId}/documents`);
  return { ok: true };
}

export async function removeEventDocument(input: { docId: string; eventId: string }) {
  const ctx = await requireContext();
  const { docId, eventId } = z
    .object({ docId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { data: doc } = await supabase.from("event_documents").select("file_path").eq("id", docId).maybeSingle();
  const { error } = await supabase.from("event_documents").delete().eq("id", docId);
  if (error) throw new Error(error.message);
  if (doc?.file_path) await supabase.storage.from("event-docs").remove([doc.file_path]);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "event_document", entityId: docId, action: "delete" });
  revalidatePath(`/events/${eventId}/documents`);
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

/* ------------------------------------------------------- site-map register */

const SiteMapAdd = z.object({ eventId: z.string().uuid() });

export async function addSiteMap(input: z.infer<typeof SiteMapAdd>) {
  const ctx = await requireContext();
  const { eventId } = SiteMapAdd.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_site_maps")
    .insert({ event_id: eventId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add site map");
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "site_map", entityId: data.id, action: "create" });
  revalidatePath(`/events/${eventId}/documents`);
  return { id: data.id };
}

const SiteMapEdit = z.object({
  mapId: z.string().uuid(),
  eventId: z.string().uuid(),
  field: z.enum(["version", "label", "url"]),
  value: z.string().max(2000),
});

export async function updateSiteMap(input: z.infer<typeof SiteMapEdit>) {
  const ctx = await requireContext();
  const { mapId, eventId, field, value } = SiteMapEdit.parse(input);
  const clean = value.trim() === "" ? null : value.trim();
  if (field === "url" && clean && !/^https?:\/\//i.test(clean)) {
    throw new Error("Links must start with http(s)://");
  }
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("event_site_maps").update({ [field]: clean } as any)).eq("id", mapId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "site_map", entityId: mapId, action: `edit:${field}`, after: { [field]: clean } });
  revalidatePath(`/events/${eventId}/documents`);
  return { ok: true };
}

export async function removeSiteMap(input: { mapId: string; eventId: string }) {
  const ctx = await requireContext();
  const { mapId, eventId } = z
    .object({ mapId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("event_site_maps").delete().eq("id", mapId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "site_map", entityId: mapId, action: "delete" });
  revalidatePath(`/events/${eventId}/documents`);
  return { ok: true };
}
