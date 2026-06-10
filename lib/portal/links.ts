/**
 * Share-link helpers for the read-only portals. Tokens are unguessable
 * 192-bit values; links can be revoked or given an expiry. The portal page
 * itself reads via the `portal_payload(token)` SECURITY DEFINER RPC, so a
 * token grants exactly that read model and nothing else.
 */
import { randomBytes } from "node:crypto";

export type ShareLinkKind = "client" | "supplier";

export interface ShareLinkLite {
  revokedAt: string | null;
  expiresAt: string | null;
}

/** 32-char URL-safe token (192 bits of entropy). */
export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/** A link is active when it has not been revoked and has not expired. */
export function isLinkActive(link: ShareLinkLite, nowISO: string): boolean {
  if (link.revokedAt) return false;
  if (link.expiresAt && link.expiresAt <= nowISO) return false;
  return true;
}

/** Absolute portal URL for a token (origin from the current request/env). */
export function portalUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/portal/${token}`;
}
