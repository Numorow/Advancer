import { Card, CardContent } from "@/components/ui/card";
import {
  fencingGrandTotalM,
  powerSummary,
  structuresSummary,
  furnitureSummary,
  transportSummary,
  productionSummary,
} from "@/lib/calc/infra";
import type { InfraRow, SupplierOpt } from "../register-grid";

export function RegisterSummary({
  registerKey,
  rows,
  suppliers,
}: {
  registerKey: string;
  rows: InfraRow[];
  suppliers: SupplierOpt[];
}) {
  if (rows.length === 0) return null;
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "Unassigned";

  switch (registerKey) {
    case "power": {
      const s = powerSummary(rows);
      return (
        <SummaryCard>
          <Metric label="Items" value={`${s.items}`} />
          <Metric label="Total quantity" value={`${s.totalQty}`} />
          <Metric label="With supplier" value={`${s.withSupplier}/${s.items}`} />
        </SummaryCard>
      );
    }
    case "structures": {
      const s = structuresSummary(rows);
      return (
        <SummaryCard>
          <Metric label="Structures" value={`${s.count}`} />
          <Metric label="Footprint" value={`${s.totalAreaM2} m²`} />
          <Metric label="Docs received" value={`${s.docs}/${s.count}`} />
          <Metric label="Engineer sign-off" value={`${s.signoff}/${s.count}`} />
          <Metric label="With supplier" value={`${s.withSupplier}/${s.count}`} />
        </SummaryCard>
      );
    }
    case "fencing": {
      const total = fencingGrandTotalM(rows);
      const withSupplier = rows.filter((r) => r.supplier_id).length;
      return (
        <SummaryCard>
          <Metric label="Runs" value={`${rows.length}`} />
          <Metric label="Total metres" value={`${total} m`} />
          <Metric label="With supplier" value={`${withSupplier}/${rows.length}`} />
        </SummaryCard>
      );
    }
    case "furniture": {
      const s = furnitureSummary(rows);
      const alloc = Object.entries(s.bySupplier).sort((a, b) => b[1] - a[1]);
      return (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Total items" value={`${s.totalQty}`} />
              <Metric label="Asset types" value={`${s.assets}`} />
              <Metric label="With supplier" value={`${s.withSupplier}/${rows.length}`} />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted-foreground)]">Supplier allocation</div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {alloc.map(([id, qty]) => (
                  <span key={id} className="rounded-full bg-[var(--muted)] px-2.5 py-1">
                    {id === "__none__" ? "Unassigned" : supplierName(id)}:{" "}
                    <span className="font-medium tabular-nums">{qty}</span>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    case "transport": {
      const s = transportSummary(rows);
      const trucks = Object.entries(s.byTruck).sort((a, b) => b[1] - a[1]);
      return (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Movements" value={`${s.total}`} />
              <Metric label="Incoming" value={`${s.incoming}`} />
              <Metric label="Outgoing" value={`${s.outgoing}`} />
            </div>
            {trucks.length > 0 && (
              <div>
                <div className="mb-1 text-xs text-[var(--muted-foreground)]">By truck type</div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {trucks.map(([t, n]) => (
                    <span key={t} className="rounded-full bg-[var(--muted)] px-2.5 py-1">
                      {t}: <span className="font-medium tabular-nums">{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }
    case "production": {
      const s = productionSummary(rows);
      return (
        <SummaryCard>
          <Metric label="Activities" value={`${s.count}`} />
          <Metric label="From" value={s.firstDate ?? "—"} />
          <Metric label="To" value={s.lastDate ?? "—"} />
        </SummaryCard>
      );
    }
    default:
      return null;
  }
}

function SummaryCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{children}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
