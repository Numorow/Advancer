/** Org membership helpers — pure, so the last-owner safety guard is testable. */

export interface MemberLite {
  userId: string;
  role: string;
}

/** Roles that may manage members / settings. */
export const ADMIN_ROLES = ["owner", "admin"] as const;

export function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/** A non-viewer with an org can edit org data (crew roles, reference values). */
export function isWriterRole(role: string): boolean {
  return role !== "viewer" && role !== "none" && role !== "";
}

/**
 * Would changing `targetUserId` to `nextRole` (or removing them when `nextRole`
 * is null) leave the org with **zero owners**? Used to stop an admin/owner from
 * locking everyone out of the organisation.
 */
export function wouldOrphanOwners(
  members: MemberLite[],
  targetUserId: string,
  nextRole: string | null,
): boolean {
  const owners = members.filter((m) => m.role === "owner");
  const targetIsOwner = owners.some((m) => m.userId === targetUserId);
  if (!targetIsOwner) return false; // changing a non-owner never reduces owners
  if (nextRole === "owner") return false; // still an owner afterwards
  return owners.length <= 1; // demoting/removing the last remaining owner
}
