"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { IMAGE_ACCEPT } from "@/lib/images";
import { removeAvatar, updateProfileName, uploadAvatar } from "./actions";

export function ProfileForm({
  fullName: initialName,
  email,
  avatarUrl,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function saveName() {
    const clean = name.trim();
    if (!clean || clean === (initialName ?? "")) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateProfileName({ fullName: clean });
        setNotice("Name saved.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save name.");
      }
    });
  }

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setNotice(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadAvatar(fd);
      if (res.error) setError(res.error);
      else {
        setNotice("Photo updated.");
        router.refresh();
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function onRemove() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await removeAvatar();
        setNotice("Photo removed.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove photo.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <Avatar userId={email ?? "me"} name={name || initialName} email={email} avatarUrl={avatarUrl} size={64} />
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
                {avatarUrl ? "Change photo" : "Upload photo"}
              </Button>
              {avatarUrl && (
                <Button size="sm" variant="outline" onClick={onRemove} disabled={pending}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">JPG/PNG up to 5MB.</p>
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div className="max-w-sm space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Display name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
              }}
              placeholder="Your name"
              className="h-9 flex-1 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <Button size="sm" onClick={saveName} disabled={pending || !name.trim() || name.trim() === (initialName ?? "")}>
              Save
            </Button>
          </div>
        </div>

        <div className="max-w-sm space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Email</label>
          <p className="text-sm">{email ?? "—"}</p>
        </div>

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        {notice && !error && <p className="text-sm text-[var(--success)]">{notice}</p>}
      </CardContent>
    </Card>
  );
}
