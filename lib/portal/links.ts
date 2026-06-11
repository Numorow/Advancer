/**
 * Share-link helpers for the read-only portals. Tokens are unguessable
 * 192-bit values; links can be revoked or given an expiry. The portal page
 * itself reads via the `portal_payload(token)` SECURITY DEFINER RPC, so a
 * token grants exactly that read model and nothing else.
 */
export type ShareLinkKind = "client" | "supplier";

export interface ShareLinkLite {
  revokedAt: string | null;
  expiresAt: string | null;
}

/** 32-char URL-safe token (192 bits of entropy). Web Crypto, so this module
 * stays importable from client components (the expiry helpers are shared). */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Default lifetime for new share links (compliance: no unbounded tokens). */
export const SHARE_LINK_DEFAULT_DAYS = 90;

/** ISO expiry `SHARE_LINK_DEFAULT_DAYS` after `nowISO`. */
export function defaultShareExpiry(nowISO: string): string {
  const d = new Date(nowISO);
  d.setUTCDate(d.getUTCDate() + SHARE_LINK_DEFAULT_DAYS);
  return d.toISOString();
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
