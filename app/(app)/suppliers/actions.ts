"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

export async function createSupplier(input: { name: string }) {
  const ctx = await requireContext();
  const name = z.string().min(1).max(200).parse(input.name).trim();
  if (ctx.role === "none" || !ctx.orgId) throw new Error("No organisation membership.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ org_id: ctx.orgId, name })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create supplier");
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    actor: ctx.userId,
    entity: "supplier",
    entityId: data.id,
    action: "create",
    after: { name },
  });
  revalidatePath("/suppliers");
  return { id: data.id };
}

async function patchSupplier(
  supplierId: string,
  patch: Record<string, unknown>,
  action: string,
) {
  const ctx = await requireContext();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("suppliers").update(patch as any)).eq("id", supplierId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    actor: ctx.userId,
    entity: "supplier",
    entityId: supplierId,
    action,
    after: patch,
  });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
}

const TextInput = z.object({
  supplierId: z.string().uuid(),
  field: z.enum(["name", "contact_name", "email", "phone", "abn", "notes"]),
  value: z.string().max(2000),
});

export async function updateSupplierText(input: z.infer<typeof TextInput>) {
  const { supplierId, field, value } = TextInput.parse(input);
  const clean = value.trim() === "" ? (field === "name" ? value.trim() : null) : value.trim();
  if (field === "name" && !clean) throw new Error("Name is required");
  await patchSupplier(supplierId, { [field]: clean }, `edit:${field}`);
  return { ok: true };
}

const FlagInput = z.object({
  supplierId: z.string().uuid(),
  field: z.enum(["insurance", "preferred"]),
  value: z.boolean(),
});

export async function updateSupplierFlag(input: z.infer<typeof FlagInput>) {
  const { supplierId, field, value } = FlagInput.parse(input);
  await patchSupplier(supplierId, { [field]: value }, `flag:${field}`);
  return { ok: true };
}

const CategoriesInput = z.object({
  supplierId: z.string().uuid(),
  value: z.string().max(2000),
});

export async function updateSupplierCategories(input: z.infer<typeof CategoriesInput>) {
  const { supplierId, value } = CategoriesInput.parse(input);
  const categories = value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  await patchSupplier(
    supplierId,
    { service_categories: categories.length ? categories : null },
    "edit:categories",
  );
  return { ok: true };
}

export async function archiveSupplier(input: { supplierId: string }) {
  const { supplierId } = z.object({ supplierId: z.string().uuid() }).parse(input);
  await patchSupplier(supplierId, { deleted_at: new Date().toISOString() }, "archive");
  return { ok: true };
}

/* ----------------------------------------------------------- supplier contacts */

export async function addSupplierContact(input: { supplierId: string; name: string }) {
  const ctx = await requireContext();
  const { supplierId, name } = z
    .object({ supplierId: z.string().uuid(), name: z.string().min(1).max(200) })
    .parse(input);
  const supabase = await createClient();
  // First contact becomes primary by default.
  const { count } = await supabase
    .from("supplier_contacts")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .is("deleted_at", null);
  const isPrimary = (count ?? 0) === 0;
  const { data, error } = await supabase
    .from("supplier_contacts")
    .insert({ supplier_id: supplierId, org_id: ctx.orgId, name: name.trim(), is_primary: isPrimary })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add contact");
  // First contact is primary → mirror its name onto the thin supplier column.
  if (isPrimary) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("suppliers").update({ contact_name: name.trim() } as any)).eq("id", supplierId);
  }
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "supplier_contact", entityId: data.id, action: "create", after: { name } });
  revalidatePath(`/suppliers/${supplierId}`);
  return { id: data.id };
}

const ContactFieldInput = z.object({
  contactId: z.string().uuid(),
  supplierId: z.string().uuid(),
  field: z.enum(["name", "role", "email", "phone"]),
  value: z.string().max(500),
});

export async function updateSupplierContactField(input: z.infer<typeof ContactFieldInput>) {
  const ctx = await requireContext();
  const { contactId, supplierId, field, value } = ContactFieldInput.parse(input);
  const clean = value.trim() === "" ? (field === "name" ? value.trim() : null) : value.trim();
  if (field === "name" && !clean) throw new Error("Name is required");
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("supplier_contacts").update({ [field]: clean } as any)).eq("id", contactId);
  if (error) throw new Error(error.message);
  // Keep the thin supplier columns (used by RFQ emails) in sync with the primary contact.
  const { data: c } = await supabase.from("supplier_contacts").select("is_primary").eq("id", contactId).maybeSingle();
  const mirror: Record<string, unknown> = { name: "contact_name", email: "email", phone: "phone" };
  if (c?.is_primary && field in mirror) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("suppliers").update({ [mirror[field] as string]: clean } as any)).eq("id", supplierId);
  }
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "supplier_contact", entityId: contactId, action: `edit:${field}`, after: { [field]: clean } });
  revalidatePath(`/suppliers/${supplierId}`);
  return { ok: true };
}

export async function setPrimaryContact(input: { contactId: string; supplierId: string }) {
  const ctx = await requireContext();
  const { contactId, supplierId } = z
    .object({ contactId: z.string().uuid(), supplierId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  // Clear the flag across the supplier's contacts, then set it on this one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("supplier_contacts").update({ is_primary: false } as any)).eq("supplier_id", supplierId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("supplier_contacts").update({ is_primary: true } as any)).eq("id", contactId);
  // Mirror the primary onto the thin supplier columns (used by RFQ emails etc.).
  const { data: c } = await supabase
    .from("supplier_contacts")
    .select("name, email, phone")
    .eq("id", contactId)
    .maybeSingle();
  if (c) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("suppliers").update({ contact_name: c.name, email: c.email, phone: c.phone } as any)).eq("id", supplierId);
  }
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "supplier_contact", entityId: contactId, action: "set_primary" });
  revalidatePath(`/suppliers/${supplierId}`);
  return { ok: true };
}

export async function removeSupplierContact(input: { contactId: string; supplierId: string }) {
  const ctx = await requireContext();
  const { contactId, supplierId } = z
    .object({ contactId: z.string().uuid(), supplierId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_contacts").delete().eq("id", contactId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "supplier_contact", entityId: contactId, action: "delete" });
  revalidatePath(`/suppliers/${supplierId}`);
  return { ok: true };
}

/* --------------------------------------------------------- supplier documents */

export async function addSupplierDocument(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireContext();
  const supplierId = String(formData.get("supplierId") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;
  const docType = String(formData.get("docType") ?? "").trim() || null;
  const file = formData.get("file");

  const parsed = z.object({ supplierId: z.string().uuid() }).safeParse({ supplierId });
  if (!parsed.success) return { error: "Bad supplier." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 20 * 1024 * 1024) return { error: "File is over 20MB." };

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const filePath = `${supplierId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("supplier-docs")
    .upload(filePath, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { error: "Upload failed." };

  const { data, error } = await supabase
    .from("supplier_documents")
    .insert({ supplier_id: supplierId, org_id: ctx.orgId, label: label ?? file.name, doc_type: docType, file_path: filePath, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save document." };
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "supplier_document", entityId: data.id, action: "create", after: { label } });
  revalidatePath(`/suppliers/${supplierId}`);
  return { ok: true };
}

export async function removeSupplierDocument(input: { docId: string; supplierId: string }) {
  const ctx = await requireContext();
  const { docId, supplierId } = z
    .object({ docId: z.string().uuid(), supplierId: z.string().uuid() })
    .parse(input);
  const supabase = await createClient();
  const { data: doc } = await supabase.from("supplier_documents").select("file_path").eq("id", docId).maybeSingle();
  const { error } = await supabase.from("supplier_documents").delete().eq("id", docId);
  if (error) throw new Error(error.message);
  if (doc?.file_path) await supabase.storage.from("supplier-docs").remove([doc.file_path]);
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "supplier_document", entityId: docId, action: "delete" });
  revalidatePath(`/suppliers/${supplierId}`);
  return { ok: true };
}
