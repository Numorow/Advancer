# Advancer — A Kyron System

The event advancement command centre: turn the Kyron event workbook into a structured,
multi-tenant web app for budgets, suppliers, RFQs, schedules, crew, management, infrastructure,
live-site operations and client-ready reports.

## Stack

- **Next.js 16** (App Router, RSC, Server Actions) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + shadcn-style UI (Kyron monochrome, light + dark mode)
- **Supabase** — Postgres, Auth (email/password), Storage, Row Level Security
- **Drizzle ORM** (schema + migrations, applied via the Supabase MCP)
- **ExcelJS** (workbook import + XLSX export), **@react-pdf/renderer** (PDF export)
- **Vitest** for the typed calc + import-parser tests

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the anon/publishable key
npm run dev                  # http://localhost:3000
npm test                     # 150 unit/integration tests
npm run build                # production build
```

The first account created via **Create account** on the login screen becomes the Kyron
organisation owner. Then **Import workbook** (`MASTER_WIP_TEMPLATE.xlsx`) to populate an event.

## Environment variables

| Key | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase publishable/anon key (safe for the client) |
| `SUPABASE_SERVICE_ROLE_KEY` | no | only for future admin tasks that bypass RLS |
| `DATABASE_URL` | no | only if running Drizzle directly against Postgres |
| `RESEND_API_KEY` | no | invite/transactional email via Resend — without it sends are skipped with a console warning |

## Security

See [SECURITY.md](SECURITY.md) — RLS model, data residency (Singapore), MFA
policy (TOTP mandatory for owners/admins), audit trail incl. auth events,
private buckets + signed URLs, 90-day share-link expiry, backup policy.

## Deploy to Vercel

The Vercel project (`Numorow/advancer`) is connected to the GitHub repo
[`Numorow/Advancer`](https://github.com/Numorow/Advancer), so **pushes to `main` auto-deploy to
production** and pull requests get preview deployments. Live at **https://advancer.events**.

- Production env has the two `NEXT_PUBLIC_SUPABASE_*` variables set (Production + Preview).
- Functions are pinned to **sin1** (Singapore) via `vercel.json` — co-located with the Supabase
  project (ap-southeast-1) so per-query latency is ~2ms instead of ~220ms cross-region.
- Manual deploy is still available with `npx vercel deploy --prod --yes`.
- After the first deploy, in **Supabase → Authentication → URL Configuration** add the production
  URL to the Site URL / redirect allowlist (needed only for email confirmation / future OAuth —
  password sign-in works without it).

> Note: Vercel serverless functions cap request bodies at ~4.5 MB; the Kyron workbook (~0.8 MB)
> is well within that. Larger uploads would need a direct-to-Storage upload flow.

## Database

Schema lives in `lib/db/schema.ts` (Drizzle, the source of truth); SQL migrations under `drizzle/`
are applied to Supabase via the MCP `apply_migration`. RLS is enabled on every table; the policy
helper functions live in a non-exposed `private` schema. Runtime data access goes through the typed
`supabase-js` server client so RLS is enforced by the user's session.

### Live updates

Every write to an event-scoped table fires a database trigger
(`private.broadcast_event_change`, `drizzle/0013_realtime_broadcast.sql`) that pokes the private
Realtime topic `event:<event_id>` — payload is just `{table, op, by}`, never row data. Each event
page mounts `LiveRefresh` (`app/(app)/events/[id]/live-refresh.tsx`), which subscribes to that
topic (authorised by an RLS policy on `realtime.messages` via `private.can_access_event`) and
debounces a `router.refresh()` for changes made by *other* users; the grids then adopt the
refreshed server props while preserving in-flight optimistic rows and focused edits.
