"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import {
  displayName,
  orderMembers,
  splitOverflow,
  type PresenceMember,
} from "@/lib/presence/avatars";

const MAX_VISIBLE = 5;

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  event_manager: "Event manager",
  operations_manager: "Operations manager",
  accounts: "Accounts",
  site_manager: "Site manager",
  viewer: "Viewer",
};

/**
 * Live "who's online" avatar stack for the app header. Joins the org's
 * Realtime Presence channel (key = user id, so multiple tabs collapse to one
 * presence) and re-renders on join/leave. Members come server-rendered; only
 * the online set is client state.
 */
export function PresenceAvatars({
  members,
  selfId,
  orgId,
}: {
  members: PresenceMember[];
  selfId: string;
  orgId: string;
}) {
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(() => new Set([selfId]));
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase.channel(`presence:org:${orgId}`, {
      config: { presence: { key: selfId } },
    });

    const refresh = () => {
      const state = channel.presenceState();
      setOnlineIds(new Set([...Object.keys(state), selfId]));
    };

    channel
      .on("presence", { event: "sync" }, refresh)
      .on("presence", { event: "join" }, refresh)
      .on("presence", { event: "leave" }, refresh)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, selfId]);

  // close the popover on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const ordered = useMemo(
    () => orderMembers(members, onlineIds, selfId),
    [members, onlineIds, selfId],
  );
  const { visible, hidden } = splitOverflow(ordered, MAX_VISIBLE);
  const onlineCount = ordered.filter((m) => onlineIds.has(m.userId)).length;

  if (members.length === 0) return null;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`${onlineCount} online · ${members.length} member${members.length === 1 ? "" : "s"}`}
        className="flex items-center rounded-full p-0.5 transition hover:bg-[var(--muted)]"
      >
        {visible.map((m, i) => (
          <span key={m.userId} className={i > 0 ? "-ml-2" : ""} style={{ zIndex: visible.length - i }}>
            <Avatar
              userId={m.userId}
              name={m.name}
              email={m.email}
              avatarUrl={m.avatarUrl}
              online={onlineIds.has(m.userId)}
              size={30}
            />
          </span>
        ))}
        {hidden > 0 && (
          <span
            className="-ml-2 flex items-center justify-center rounded-full bg-[var(--muted)] text-[10px] font-semibold text-[var(--muted-foreground)] ring-2 ring-[var(--card)]"
            style={{ width: 30, height: 30, zIndex: 0 }}
          >
            +{hidden}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-md border bg-[var(--card)] py-1 shadow-lg">
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Team · {onlineCount} online
          </div>
          <div className="max-h-80 overflow-y-auto">
            {ordered.map((m) => {
              const online = onlineIds.has(m.userId);
              return (
                <div key={m.userId} className="flex items-center gap-2.5 px-3 py-1.5">
                  <Avatar
                    userId={m.userId}
                    name={m.name}
                    email={m.email}
                    avatarUrl={m.avatarUrl}
                    online={online}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {displayName(m)}
                      {m.userId === selfId && (
                        <span className="ml-1 text-xs font-normal text-[var(--muted-foreground)]">(you)</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-[var(--muted-foreground)]">
                      {ROLE_LABEL[m.role] ?? m.role}
                    </div>
                  </div>
                  <span
                    className={
                      "text-xs " + (online ? "text-[var(--success)]" : "text-[var(--muted-foreground)]")
                    }
                  >
                    {online ? "online" : "offline"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
