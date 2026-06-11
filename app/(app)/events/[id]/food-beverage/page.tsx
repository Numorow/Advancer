import { createClient } from "@/lib/supabase/server";
import { fetchZoneOptions } from "@/lib/reference/zones";
import { FnbView, type VendorRow, type CateringRow, type SupplierOpt } from "./fnb-view";

type SupplierEmbed = { name: string } | null;
const toNum = (v: unknown): number | null => (v == null ? null : Number(v));

export default async function FoodBeveragePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // F&B tables post-date the generated Database types — read them untyped (cf. infra).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: vendors }, { data: catering }, { data: suppliers }, zones] = await Promise.all([
    sb
      .from("fnb_vendors")
      .select("*, suppliers(name)")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
    sb
      .from("fnb_catering_orders")
      .select("*, suppliers(name)")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("sort", { ascending: true }),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    fetchZoneOptions(supabase),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendorRows: VendorRow[] = (vendors ?? []).map((v: any) => ({
    id: v.id,
    supplierId: v.supplier_id,
    supplierName: (v.suppliers as SupplierEmbed)?.name ?? null,
    tradingName: v.trading_name,
    vendorType: v.vendor_type,
    location: v.location,
    frontageM: toNum(v.frontage_m),
    powerReq: v.power_req,
    water: v.water,
    waste: v.waste,
    arrivalDate: v.arrival_date,
    arrivalTime: v.arrival_time ? String(v.arrival_time).slice(0, 5) : null,
    licenceStatus: v.licence_status,
    coiStatus: v.coi_status,
    permitStatus: v.permit_status,
    siteFeeCents: v.site_fee_cents,
    commissionPct: toNum(v.commission_pct),
    bondCents: v.bond_cents,
    paymentStatus: v.payment_status,
    notes: v.notes,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cateringRows: CateringRow[] = (catering ?? []).map((c: any) => ({
    id: c.id,
    orderDate: c.order_date,
    meal: c.meal,
    headcount: c.headcount,
    dietary: c.dietary,
    supplierId: c.supplier_id,
    supplierName: (c.suppliers as SupplierEmbed)?.name ?? null,
    costCents: c.cost_cents,
    notes: c.notes,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Food &amp; Beverage</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Vendor line-up, site needs and compliance, the commercial deal (site fees, commission, bonds —
          income tracked here, not in the budget), plus crew catering orders.
        </p>
      </div>
      <FnbView
        eventId={id}
        vendors={vendorRows}
        catering={cateringRows}
        suppliers={(suppliers ?? []) as SupplierOpt[]}
        zones={zones}
      />
    </div>
  );
}
