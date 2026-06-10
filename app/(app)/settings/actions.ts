"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext, type SessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { wouldOrphanOwners, isAdminRole, isWriterRole, type MemberLite } from "@/lib/org/members";

const ORG_ROLES = [
  "owner",
  "admin",
  "event_manager",
  "operations_manager",
  "accounts",
  "site_manager",
  "viewer",
] as const;

function requireAdmin(ctx: SessionContext) {
  if (!isAdminRole(ctx.role)) throw new Error("Only an owner or admin can manage members.");
}
function requireWriter(ctx: SessionContext) {
  if (!isWriterRole(ctx.role)) throw new Error("You don't have permission to edit organisation settings.");
}

/* ---------------------------------------------------------------- members */

export async function updateMemberRole(input: { memberId: string; role: string }) {
  const ctx = await requireContext();
  requireAdmin(ctx);
  const { memberId, role } = z
    .object({ memberId: z.string().uuid(), role: z.enum(ORG_ROLES) })
    .parse(input);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organisation_members")
    .select("user_id, org_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.org_id !== ctx.orgId) throw new Error("Member not found.");
  const { data: all } = await supabase.from("organisation_members").select("user_id, role").eq("org_id", ctx.orgId);
  const memberLites: MemberLite[] = (all ?? []).map((m) => ({ userId: m.user_id, role: m.role }));
  if (wouldOrphanOwners(memberLites, member.user_id, role)) {
    throw new Error("The organisation must keep at least one owner.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("organisation_members").update({ role } as any)).eq("id", memberId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "org_member", entityId: memberId, action: "role", after: { role } });
  revalidatePath("/settings/members");
  return { ok: true };
}

export async function removeMember(input: { memberId: string }) {
  const ctx = await requireContext();
  requireAdmin(ctx);
  const { memberId } = z.object({ memberId: z.string().uuid() }).parse(input);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organisation_members")
    .select("user_id, org_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.org_id !== ctx.orgId) throw new Error("Member not found.");
  const { data: all } = await supabase.from("organisation_members").select("user_id, role").eq("org_id", ctx.orgId);
  const memberLites: MemberLite[] = (all ?? []).map((m) => ({ userId: m.user_id, role: m.role }));
  if (wouldOrphanOwners(memberLites, member.user_id, null)) {
    throw new Error("You can't remove the last owner of the organisation.");
  }
  const { error } = await supabase.from("organisation_members").delete().eq("id", memberId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "org_member", entityId: memberId, action: "remove" });
  revalidatePath("/settings/members");
  return { ok: true };
}

/* ------------------------------------------------------------- crew roles */

export async function addCrewRole(input: { name: string }) {
  const ctx = await requireContext();
  requireWriter(ctx);
  const name = z.string().min(1).max(120).parse(input.name).trim();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("crew_roles")
    .select("sort")
    .eq("org_id", ctx.orgId)
    .order("sort", { ascending: false })
    .limit(1);
  const nextSort = (existing?.[0]?.sort ?? -1) + 1;
  const { data, error } = await supabase
    .from("crew_roles")
    .insert({ org_id: ctx.orgId, name, sort: nextSort })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add role");
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "crew_role", entityId: data.id, action: "create", after: { name } });
  revalidatePath("/settings/crew-roles");
  return { id: data.id };
}

export async function updateCrewRole(input: {
  roleId: string;
  field: "name" | "default_rate_cents";
  value: string | number | null;
}) {
  const ctx = await requireContext();
  requireWriter(ctx);
  const { roleId, field, value } = z
    .object({
      roleId: z.string().uuid(),
      field: z.enum(["name", "default_rate_cents"]),
      value: z.union([z.string(), z.number(), z.null()]),
    })
    .parse(input);
  let patch: Record<string, unknown>;
  if (field === "name") {
    const name = String(value ?? "").trim();
    if (!name) throw new Error("Name is required");
    patch = { name };
  } else {
    const cents = value === null || value === "" ? null : Number(value);
    if (cents !== null && (!Number.isInteger(cents) || cents < 0)) throw new Error("Invalid rate");
    patch = { default_rate_cents: cents };
  }
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("crew_roles").update(patch as any)).eq("id", roleId).eq("org_id", ctx.orgId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "crew_role", entityId: roleId, action: `edit:${field}`, after: patch });
  revalidatePath("/settings/crew-roles");
  return { ok: true };
}

export async function removeCrewRole(input: { roleId: string }) {
  const ctx = await requireContext();
  requireWriter(ctx);
  const { roleId } = z.object({ roleId: z.string().uuid() }).parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("crew_roles").delete().eq("id", roleId).eq("org_id", ctx.orgId);
  if (error) throw new Error("Could not delete — this role may be in use by a crew shift.");
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "crew_role", entityId: roleId, action: "delete" });
  revalidatePath("/settings/crew-roles");
  return { ok: true };
}

/* -------------------------------------------------------- reference values */

export async function addReferenceValue(input: { category: string; value: string; label?: string | null }) {
  const ctx = await requireContext();
  requireWriter(ctx);
  const { category, value, label } = z
    .object({ category: z.string().min(1).max(60), value: z.string().min(1).max(200), label: z.string().max(200).nullable().optional() })
    .parse(input);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reference_values")
    .select("sort")
    .eq("org_id", ctx.orgId)
    .eq("category", category.trim())
    .order("sort", { ascending: false })
    .limit(1);
  const nextSort = (existing?.[0]?.sort ?? -1) + 1;
  const { data, error } = await supabase
    .from("reference_values")
    .insert({ org_id: ctx.orgId, category: category.trim(), value: value.trim(), label: label?.trim() || null, sort: nextSort })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add value");
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "reference_value", entityId: data.id, action: "create", after: { category, value } });
  revalidatePath("/settings/reference");
  return { id: data.id };
}

export async function updateReferenceValue(input: { id: string; field: "value" | "label"; value: string }) {
  const ctx = await requireContext();
  requireWriter(ctx);
  const { id, field, value } = z
    .object({ id: z.string().uuid(), field: z.enum(["value", "label"]), value: z.string().max(200) })
    .parse(input);
  const clean = value.trim() === "" ? (field === "value" ? value.trim() : null) : value.trim();
  if (field === "value" && !clean) throw new Error("Value is required");
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("reference_values").update({ [field]: clean } as any)).eq("id", id).eq("org_id", ctx.orgId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "reference_value", entityId: id, action: `edit:${field}`, after: { [field]: clean } });
  revalidatePath("/settings/reference");
  return { ok: true };
}

export async function removeReferenceValue(input: { id: string }) {
  const ctx = await requireContext();
  requireWriter(ctx);
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("reference_values").delete().eq("id", id).eq("org_id", ctx.orgId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, actor: ctx.userId, entity: "reference_value", entityId: id, action: "delete" });
  revalidatePath("/settings/reference");
  return { ok: true };
}
