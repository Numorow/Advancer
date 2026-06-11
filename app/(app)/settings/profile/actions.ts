"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { displayableImageError } from "@/lib/images";

function revalidateProfile() {
  revalidatePath("/settings/profile");
  revalidatePath("/", "layout"); // header avatar row renders on every page
}

export async function updateProfileName(input: { fullName: string }) {
  const ctx = await requireContext();
  const { fullName } = z.object({ fullName: z.string().trim().min(1).max(200) }).parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", ctx.userId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    actor: ctx.userId,
    entity: "profile",
    entityId: ctx.userId,
    action: "edit:name",
    after: { full_name: fullName },
  });
  revalidateProfile();
  return { ok: true };
}

export async function uploadAvatar(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireContext();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  const typeError = displayableImageError(file);
  if (typeError) return { error: typeError };
  if (file.size > 5 * 1024 * 1024) return { error: "Image is over 5MB." };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", ctx.userId)
    .maybeSingle();

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  // storage policy requires the first path segment to be the caller's user id
  const filePath = `${ctx.userId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(filePath, buffer, { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) return { error: "Upload failed." };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: filePath, updated_at: new Date().toISOString() })
    .eq("id", ctx.userId);
  if (error) return { error: error.message };
  if (profile?.avatar_path) await supabase.storage.from("avatars").remove([profile.avatar_path]);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    actor: ctx.userId,
    entity: "profile",
    entityId: ctx.userId,
    action: "avatar:set",
  });
  revalidateProfile();
  return { ok: true };
}

export async function removeAvatar() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", ctx.userId)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null, updated_at: new Date().toISOString() })
    .eq("id", ctx.userId);
  if (error) throw new Error(error.message);
  if (profile?.avatar_path) await supabase.storage.from("avatars").remove([profile.avatar_path]);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    actor: ctx.userId,
    entity: "profile",
    entityId: ctx.userId,
    action: "avatar:remove",
  });
  revalidateProfile();
  return { ok: true };
}
