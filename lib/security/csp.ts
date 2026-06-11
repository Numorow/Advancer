/**
 * Content-Security-Policy builder (M21). Pure so the directive matrix is
 * unit-testable; the per-request nonce is generated in the middleware.
 *
 * Strategy: nonce + 'strict-dynamic'. The middleware mints one nonce per
 * request; Next.js stamps it onto every script it injects (it reads the CSP
 * from the request header), and our one inline script — the dark-mode boot in
 * app/layout.tsx — carries the same nonce. 'strict-dynamic' then trusts
 * whatever those nonced scripts load (the _next/static chunks), so we never
 * fall back to 'unsafe-inline'/'self' script gadgets.
 *
 * Dev needs two relaxations Turbopack's HMR can't live without: 'unsafe-eval'
 * (React Refresh) and a ws: connect source (the HMR socket).
 */

import { THEME_BOOT_HASH } from "./theme-boot";

export interface CspOptions {
  /** Per-request nonce, base64. */
  nonce: string;
  /** NEXT_PUBLIC_SUPABASE_URL — its origin is allowed for REST, realtime and storage. */
  supabaseUrl: string;
  /** Loosen for local `next dev` (Turbopack HMR). */
  dev: boolean;
}

export function buildContentSecurityPolicy({ nonce, supabaseUrl, dev }: CspOptions): string {
  const supabase = new URL(supabaseUrl).origin; // https://<ref>.supabase.co
  const supabaseSocket = supabase.replace(/^https:/, "wss:"); // realtime (M19)

  const directives: Record<string, (string | false)[]> = {
    "default-src": ["'self'"],
    // nonce → Next's injected scripts; hash → our inline dark-mode boot script
    // (app/layout.tsx). 'self' is ignored by browsers honouring 'strict-dynamic'
    // but kept for the long tail that doesn't. 'unsafe-eval' is dev-only (HMR).
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      `'${THEME_BOOT_HASH}'`,
      "'strict-dynamic'",
      dev && "'unsafe-eval'",
    ],
    // Next/Tailwind inject inline <style> and style="" attributes; noncing
    // those is impractical and inline styles are not an XSS vector worth the cost.
    "style-src": ["'self'", "'unsafe-inline'"],
    // data: → TOTP QR codes; supabase → signed storage URLs (avatars, photos, covers).
    "img-src": ["'self'", "data:", "blob:", supabase],
    "font-src": ["'self'", "data:"],
    // supabase REST + realtime websocket; ws: covers the dev HMR socket.
    "connect-src": ["'self'", supabase, supabaseSocket, dev && "ws:"],
    "worker-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"], // mirrors X-Frame-Options: DENY
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`)
    .join("; ");
}
