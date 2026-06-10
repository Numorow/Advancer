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

## Deploy to Vercel

The Vercel project (`Numorow/advancer`) is connected to the GitHub repo
[`Numorow/Advancer`](https://github.com/Numorow/Advancer), so **pushes to `main` auto-deploy to
production** and pull requests get preview deployments. Live at **https://advancer.events**.

- Production env has the two `NEXT_PUBLIC_SUPABASE_*` variables set (Production + Preview).
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
