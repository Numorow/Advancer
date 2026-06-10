/**
 * Pure helpers for the presence avatar row — initials, deterministic colours
 * and ordering. Kept dependency-free so they're unit-testable and usable from
 * both server and client components.
 */

export interface PresenceMember {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  avatarUrl: string | null;
}

/** "Kyle Bailey" → "KB"; falls back to the email's first two letters, then "?". */
export function initialsFor(name: string | null, email: string | null): string {
  const clean = (name ?? "").trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }
  const local = (email ?? "").split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  if (local) return local.slice(0, 2).toUpperCase();
  return "?";
}

/** Deterministic hue (0–359) from a user id, for the initials background. */
export function avatarHue(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/** Display label for a member. */
export function displayName(m: Pick<PresenceMember, "name" | "email" | "userId">): string {
  return m.name?.trim() || m.email || m.userId.slice(0, 8);
}

/** Self first, then online members A→Z, then offline A→Z. */
export function orderMembers<T extends PresenceMember>(
  members: T[],
  onlineIds: ReadonlySet<string>,
  selfId: string,
): T[] {
  const byName = (a: T, b: T) => displayName(a).localeCompare(displayName(b));
  const self = members.filter((m) => m.userId === selfId);
  const online = members.filter((m) => m.userId !== selfId && onlineIds.has(m.userId)).sort(byName);
  const offline = members.filter((m) => m.userId !== selfId && !onlineIds.has(m.userId)).sort(byName);
  return [...self, ...online, ...offline];
}

/** First `max` members visible; the rest collapse into a "+N" overflow. */
export function splitOverflow<T>(list: T[], max: number): { visible: T[]; hidden: number } {
  if (list.length <= max) return { visible: list, hidden: 0 };
  return { visible: list.slice(0, max), hidden: list.length - max };
}
