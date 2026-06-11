# Advancer — Security & Data Handling

Advancer stores commercially sensitive event data (client contacts, billing
entities/ABNs, budgets, supplier pricing). This document describes how that
data is protected. Incident contact: **hello@eventsitepro.com**.

## Data residency

- Database, auth and file storage: **Supabase, AWS ap-southeast-1 (Singapore)**.
- Application compute: **Vercel, sin1 (Singapore)** — co-located with the database.
- No data is stored in the browser beyond the Supabase session cookie.

## Access control

- **Row-Level Security on every table.** Policies are org-scoped (and
  event-scoped for event data) via SECURITY DEFINER helper functions kept in a
  non-API-exposed `private` schema. A user can only ever read/write rows of
  organisations they are a member of; the `viewer` role is read-only.
- **No service-role key at runtime.** The app runs entirely on the publishable
  anon key; every query is authorised by the user's session under RLS.
- **Authentication:** email + password via Supabase Auth (asymmetric ES256
  JWTs, local verification in middleware). Leaked-password protection
  (HaveIBeenPwned) and a 10-character minimum are enforced project-side.
- **MFA (TOTP):** mandatory for `owner`/`admin` roles, opt-in for everyone
  else (Settings → Security). Enrolled users must step up to AAL2 each
  session; enforcement lives in `lib/auth.ts` + `lib/auth/mfa-policy.ts`.
- Self-service password reset is rate-limited by Supabase Auth and reveals
  nothing about account existence.

## Files & sharing

- All storage buckets are **private**; files are served via short-lived signed
  URLs only. Avatar uploads are restricted to the owner's folder by policy.
- Read-only portal links use unguessable **192-bit tokens**, are scoped to a
  single event read-model via a SECURITY DEFINER RPC (clients never see
  budgets/documents; suppliers only see their own RFQs), **expire after 90
  days by default**, and can be revoked instantly.
- Image uploads are restricted to browser-displayable formats.

## Audit trail

`audit_log` records every data mutation (actor, entity, before/after) and —
via database triggers — authentication events: sign-up, sign-in, MFA
enrolment/removal. Viewable under Settings → Activity log; rows are
org-scoped by RLS and never deleted by the app.

## Email

Transactional email (signup confirmation, password reset, member invites) is
sent via **Resend** from `no-reply@advancer.events` (SPF + DKIM verified).
No event data is included in emails beyond organisation name and role.

## Encryption & backups

- Encryption at rest (AES-256) and in transit (TLS) — Supabase/AWS defaults;
  SSL is enforced on database connections.
- Daily automated backups (Supabase Pro, 7-day retention). Point-in-time
  recovery is a planned upgrade if write volume grows.

## Known decisions / future work

- **No Content-Security-Policy header yet.** Next.js streams RSC payloads as
  inline scripts, so a CSP without nonces would need `script-src
  'unsafe-inline'`, which adds no real protection. A nonce-based middleware
  CSP is the planned follow-up. The other hardening headers (HSTS,
  X-Frame-Options DENY, nosniff, referrer & permissions policies) ship today.
- Field-level encryption for ABN/billing fields is a future option; no bank
  account or card data is stored anywhere in the system.
- Multi-org audit attribution: auth events are attributed to the actor's
  organisation (single-org deployment today).
