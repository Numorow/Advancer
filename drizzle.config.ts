import type { Config } from "drizzle-kit";

// Drizzle is the source of truth for the schema. `npm run db:generate`
// emits SQL under ./drizzle which we apply to Supabase via the MCP
// apply_migration tool. A live DATABASE_URL is only needed if you later
// choose to push/pull directly against Postgres.
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder",
  },
  verbose: true,
  strict: true,
} satisfies Config;
