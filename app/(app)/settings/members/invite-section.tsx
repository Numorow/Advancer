"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createInvite, revokeInvite } from "../actions";

export interface InviteRow {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

type InviteRole =
  | "admin"
  | "event_manager"
  | "operations_manager"
  | "accounts"
  | "site_manager"
  | "viewer";

const ROLE_OPTIONS: { value: InviteRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "event_manager", label: "Event manager" },
  { value: "operations_manager", label: "Operations manager" },
  { value: "accounts", label: "Accounts" },
  { value: "site_manager", label: "Site manager" },
  { value: "viewer", label: "Viewer" },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

export function InviteSection({ invites, canManage }: { invites: InviteRow[]; canManage: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("event_manager");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canManage && invites.length === 0) return null;

  function invite() {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await createInvite({ email: clean, role });
        setEmail("");
        setNotice(`Invited ${clean} — they sign up at this site with that email and get access automatically.`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create invite.");
      }
    });
  }

  function revoke(inviteId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await revokeInvite({ inviteId });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not revoke invite.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailPlus className="h-4 w-4" /> Invites
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") invite();
              }}
              placeholder="teammate@company.com"
              className="h-9 w-72 max-w-full rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as InviteRole)}
              className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={invite} disabled={pending || !email.trim()}>
              Invite
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        {notice && <p className="text-sm text-[var(--success)]">{notice}</p>}

        {invites.length > 0 ? (
          <div className="divide-y rounded-md border">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{i.email}</span>
                <Badge tone="muted">{ROLE_LABEL[i.role] ?? i.role}</Badge>
                <span className="text-xs text-[var(--muted-foreground)]">
                  invited {i.createdAt.slice(0, 10)}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => revoke(i.id)}
                    disabled={pending}
                    className="text-xs text-[var(--destructive)] hover:underline disabled:opacity-50"
                  >
                    revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">
            No pending invites. Invitees sign up with their invited email and membership is granted
            automatically on first sign-in.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
