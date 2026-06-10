import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRegister } from "@/lib/infra/registers";
import { RegisterGrid, type InfraRow, type SupplierOpt } from "../register-grid";
import { ToiletSummary } from "./toilet-summary";
import { RegisterSummary } from "./register-summary";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ id: string; register: string }>;
}) {
  const { id, register } = await params;
  const reg = getRegister(register);
  if (!reg) notFound();

  const supabase = await createClient();
  const hasSupplier = reg.columns.some((c) => c.type === "supplier");
  const [rowsRes, suppliersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from(reg.table)
      .select("*")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
    hasSupplier
      ? supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name")
      : Promise.resolve({ data: [] as SupplierOpt[] }),
  ]);

  const rows = (rowsRes.data ?? []) as InfraRow[];
  const suppliers = (suppliersRes.data ?? []) as SupplierOpt[];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">{reg.description}</p>
      {reg.key === "toilets" ? (
        <ToiletSummary rows={rows as never} />
      ) : (
        <RegisterSummary registerKey={reg.key} rows={rows} suppliers={suppliers} />
      )}
      <RegisterGrid
        eventId={id}
        table={reg.table}
        columns={reg.columns}
        computed={reg.computed}
        rows={rows}
        suppliers={suppliers}
      />
    </div>
  );
}
