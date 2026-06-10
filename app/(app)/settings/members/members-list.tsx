"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateMemberRole, removeMember } from "../actions";

export interface MemberRow {
  id: string;
  userId: string;
  role: string;
  email: string | null;
  fullName: string | null;
  isYou: boolean;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "event_manager", label: "Event manager" },
  { value: "operations_manager", label: "Operations manager" },
  { value: "accounts", label: "Accounts" },
  { value: "site_manager", label: "Site manager" },
  { value: "viewer", label: "Viewer" },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

export function MembersList({ rows, canManage }: { rows: MemberRow[]; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeRole(memberId: string, role: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateMemberRole({ memberId, role });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not change role.");
      }
    });
  }
  function remove(memberId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeMember({ memberId });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove member.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-0">
        {error && <p className="border-b bg-[var(--destructive)]/10 px-4 py-2 text-sm text-[var(--destructive)]">{error}</p>}
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Member</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2.5">
                  <div className="font-medium">
                    {m.fullName || m.email || m.userId.slice(0, 8)}
                    {m.isYou && <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">(you)</span>}
                  </div>
                  {m.email && m.fullName && <div className="text-xs text-[var(--muted-foreground)]">{m.email}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {canManage ? (
                    <select
                      value={m.role}
                      disabled={pending}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                      className="h-8 rounded-md border bg-[var(--card)] px-2 text-sm"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone="muted">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      disabled={pending}
                      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] disabled:opacity-50"
                    >
                      remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
