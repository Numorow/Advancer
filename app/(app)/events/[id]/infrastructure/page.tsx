import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REGISTERS } from "@/lib/infra/registers";
import {
  infraReadiness,
  fencingGrandTotalM,
  powerSummary,
  structuresSummary,
  furnitureSummary,
  transportSummary,
  productionSummary,
} from "@/lib/calc/infra";

type Row = Record<string, unknown>;
const SUPPLIER_REGS = new Set(["power", "structures", "fencing", "furniture"]);

export default async function InfrastructureOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (table: string) => (supabase as any).from(table).select("*").eq("event_id", id).is("deleted_at", null);

  const results = await Promise.all([
    q("power_requirements"),
    q("structures"),
    q("fencing_requirements"),
    q("furniture_distribution"),
    q("transport_movements"),
    q("production_items"),
    q("toilet_calculations"),
  ]);
  const [power, structures, fencing, furniture, transport, production, toilets] = results.map(
    (r) => (r.data ?? []) as Row[],
  );
  const byKey: Record<string, Row[]> = { power, structures, fencing, furniture, transport, production, toilets };

  const readiness = infraReadiness({ power, structures, fencing, furniture, toilets });

  function headline(key: string, rows: Row[]): string {
    switch (key) {
      case "power": {
        const s = powerSummary(rows);
        return `${s.totalQty} units · ${s.items} items`;
      }
      case "structures": {
        const s = structuresSummary(rows);
        return `${s.totalAreaM2} m² · ${s.signoff}/${s.count} signed off`;
      }
      case "fencing":
        return `${fencingGrandTotalM(rows)} m total`;
      case "furniture":
        return `${furnitureSummary(rows).totalQty} items`;
      case "transport": {
        const s = transportSummary(rows);
        return `${s.incoming} in · ${s.outgoing} out`;
      }
      case "production":
        return `${productionSummary(rows).count} activities`;
      case "toilets":
        return `${rows.reduce((a, r) => a + (Number(r.pans) || 0), 0)} pans`;
      default:
        return "";
    }
  }
  function coverage(key: string, rows: Row[]): string | null {
    if (!SUPPLIER_REGS.has(key) || rows.length === 0) return null;
    return `${rows.filter((r) => r.supplier_id).length}/${rows.length} with supplier`;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Infrastructure readiness</div>
            <div className="text-3xl font-semibold tabular-nums">{readiness.score}%</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {readiness.parts.length === 0 ? (
              <span className="text-[var(--muted-foreground)]">No infrastructure data yet.</span>
            ) : (
              readiness.parts.map((p) => (
                <span key={p.label} className="rounded-full bg-[var(--muted)] px-2.5 py-1">
                  {p.label}: <span className="font-medium tabular-nums">{p.pct}%</span>
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REGISTERS.map((reg) => {
          const rows = byKey[reg.key] ?? [];
          const cov = coverage(reg.key, rows);
          return (
            <Link key={reg.key} href={`/events/${id}/infrastructure/${reg.key}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{reg.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-[var(--muted-foreground)]">
                  <div className="font-medium text-[var(--foreground)]">{rows.length ? headline(reg.key, rows) : "Empty"}</div>
                  <div>
                    {rows.length} row{rows.length === 1 ? "" : "s"}
                    {cov ? ` · ${cov}` : ""}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
