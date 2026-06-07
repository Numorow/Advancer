import { toiletAreaSummary } from "@/lib/calc/infra";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ToiletRow {
  area: string | null;
  quantity: number | null;
  pans: number | null;
  capacity: number | null;
  ratio_target: number | null;
}

const AREAS = ["General", "VIP"];

function firstNonNull(values: (number | null)[]): number | null {
  for (const v of values) if (v != null) return v;
  return null;
}

export function ToiletSummary({ rows }: { rows: ToiletRow[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {AREAS.map((area) => {
        const lines = rows.filter((r) => (r.area ?? "") === area);
        const capacity = firstNonNull(lines.map((l) => l.capacity));
        const target = firstNonNull(lines.map((l) => l.ratio_target));
        const s = toiletAreaSummary(
          lines.map((l) => ({ quantity: l.quantity, pans: l.pans })),
          capacity,
          target,
        );
        return (
          <Card key={area}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{area} area</span>
                {s.meetsTarget != null && (
                  <Badge tone={s.meetsTarget ? "success" : "danger"}>
                    {s.meetsTarget ? "within target" : "over target"}
                  </Badge>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <Metric label="Total pans" value={`${s.totalPans}`} />
                <Metric label="Capacity" value={s.capacity == null ? "—" : `${s.capacity}`} />
                <Metric
                  label="People / pan"
                  value={s.ratio == null ? "n/a" : `${Math.round(s.ratio * 10) / 10}`}
                  sub={s.ratioTarget != null ? `target ${s.ratioTarget}` : undefined}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-[var(--muted-foreground)]">{sub}</div>}
    </div>
  );
}
