import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_path")
    .eq("id", ctx.userId)
    .maybeSingle();

  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your name and photo — shown to teammates in the online avatars and members list.
        </p>
      </div>
      <ProfileForm
        fullName={profile?.full_name ?? null}
        email={profile?.email ?? ctx.email}
        avatarUrl={avatarUrl}
      />
    </div>
  );
}
