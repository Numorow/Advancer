import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LIMIT = 100;

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const ctx = await requireContext();
  const { entity } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("audit_log")
    .select("id, created_at, actor, entity, entity_id, action, event_id")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (entity) q = q.eq("entity", entity);
  const { data: rows } = await q;

  const actorIds = [...new Set((rows ?? []).map((r) => r.actor).filter(Boolean))] as string[];
  const eventIds = [...new Set((rows ?? []).map((r) => r.event_id).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: events }] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, email, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; email: string | null; full_name: string | null }[] }),
    eventIds.length
      ? supabase.from("events").select("id, name").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const emap = new Map((events ?? []).map((e) => [e.id, e.name]));

  // Entity filter chips, derived from the recent rows (+ keep the active one visible).
  const entitySet = new Set((rows ?? []).map((r) => r.entity));
  if (entity) entitySet.add(entity);
  const entities = [...entitySet].sort();

  function who(actor: string | null): string {
    if (!actor) return "system";
    const p = pmap.get(actor);
    return p?.full_name || p?.email || `${actor.slice(0, 8)}…`;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Activity log</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          The {LIMIT} most recent changes across {ctx.orgName}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Chip href="/settings/activity" active={!entity}>
          All
        </Chip>
        {entities.map((en) => (
          <Chip key={en} href={`/settings/activity?entity=${encodeURIComponent(en)}`} active={entity === en}>
            {en}
          </Chip>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Who</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Entity</th>
                <th className="px-4 py-2 font-medium">Event</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-[var(--muted-foreground)]">
                    {fmtWhen(r.created_at)}
                  </td>
                  <td className="px-4 py-2">{who(r.actor)}</td>
                  <td className="px-4 py-2">
                    <Badge tone="muted">{r.action}</Badge>
                  </td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">{r.entity}</td>
                  <td className="px-4 py-2 text-xs text-[var(--muted-foreground)]">
                    {r.event_id ? emap.get(r.event_id) ?? "—" : "—"}
                  </td>
                </tr>
              ))}
              {(rows ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    No activity recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 ${active ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-[var(--muted)]"}`}
    >
      {children}
    </Link>
  );
}
