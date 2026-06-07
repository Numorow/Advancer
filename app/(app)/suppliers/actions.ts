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
