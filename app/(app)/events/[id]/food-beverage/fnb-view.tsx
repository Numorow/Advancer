"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { EditableCell } from "@/components/editable-cell";
import { OptionDatalist } from "@/components/option-datalist";
import { StatusButton } from "@/components/status-button";
import { dollarsToCents, formatCents } from "@/lib/calc/money";
import { fnbRollup } from "@/lib/calc/fnb";
import {
  addCateringOrder,
  addVendor,
  removeCateringOrder,
  removeVendor,
  updateCateringField,
  updateVendorField,
} from "./actions";

export interface SupplierOpt {
  id: string;
  name: string;
}

export interface VendorRow {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  tradingName: string | null;
  vendorType: string | null;
  location: string | null;
  frontageM: number | null;
  powerReq: string | null;
  water: boolean;
  waste: boolean;
  arrivalDate: string | null;
  arrivalTime: string | null;
  licenceStatus: string;
  coiStatus: string;
  permitStatus: string;
  siteFeeCents: number | null;
  commissionPct: number | null;
  bondCents: number | null;
  paymentStatus: string;
  notes: string | null;
}

export interface CateringRow {
  id: string;
  orderDate: string | null;
  meal: string | null;
  headcount: number | null;
  dietary: string | null;
  supplierId: string | null;
  supplierName: string | null;
  costCents: number | null;
  notes: string | null;
}

type RawValue = string | number | boolean | null;

const TYPE_SUGGESTIONS = ["Food truck", "Stall", "Bar", "Coffee", "Dessert", "Catering"];
const MEAL_SUGGESTIONS = ["Breakfast", "Lunch", "Dinner", "Supper", "Snacks"];

export function FnbView({
  eventId,
  vendors: initialVendors,
  catering: initialCatering,
  suppliers,
  zones,
}: {
  eventId: string;
  vendors: VendorRow[];
  catering: CateringRow[];
  suppliers: SupplierOpt[];
  zones: string[];
}) {
  const [vendors, setVendors] = useState(initialVendors);
  const [catering, setCatering] = useState(initialCatering);
  const [, startTransition] = useTransition();

  // Adopt server re-renders (own revalidate + foreign edits via LiveRefresh).
  useEffect(() => setVendors(initialVendors), [initialVendors]);
  useEffect(() => setCatering(initialCatering), [initialCatering]);

  const supplierName = (id: string | null) =>
    id ? suppliers.find((s) => s.id === id)?.name ?? null : null;

  function editVendor(id: string, camel: keyof VendorRow, snake: string, value: RawValue, extra?: Partial<VendorRow>) {
    const prev = vendors;
    setVendors((vs) => vs.map((v) => (v.id === id ? { ...v, [camel]: value, ...extra } : v)));
    startTransition(() =>
      void updateVendorField({ eventId, rowId: id, field: snake, value }).catch(() => setVendors(prev)),
    );
  }

  function editCatering(id: string, camel: keyof CateringRow, snake: string, value: RawValue, extra?: Partial<CateringRow>) {
    const prev = catering;
    setCatering((cs) => cs.map((c) => (c.id === id ? { ...c, [camel]: value, ...extra } : c)));
    startTransition(() =>
      void updateCateringField({ eventId, rowId: id, field: snake, value }).catch(() => setCatering(prev)),
    );
  }

  function onAddVendor() {
    startTransition(async () => {
      const { id } = await addVendor({ eventId });
      setVendors((vs) =>
        vs.some((v) => v.id === id)
          ? vs
          : [
              ...vs,
              {
                id,
                supplierId: null,
                supplierName: null,
                tradingName: null,
                vendorType: null,
                location: null,
                frontageM: null,
                powerReq: null,
                water: false,
                waste: false,
                arrivalDate: null,
                arrivalTime: null,
                licenceStatus: "missing",
                coiStatus: "missing",
                permitStatus: "missing",
                siteFeeCents: null,
                commissionPct: null,
                bondCents: null,
                paymentStatus: "unpaid",
                notes: null,
              },
            ],
      );
    });
  }

  function onRemoveVendor(id: string) {
    const prev = vendors;
    setVendors((vs) => vs.filter((v) => v.id !== id));
    startTransition(() => void removeVendor({ eventId, rowId: id }).catch(() => setVendors(prev)));
  }

  function onAddCatering() {
    startTransition(async () => {
      const { id } = await addCateringOrder({ eventId });
      setCatering((cs) =>
        cs.some((c) => c.id === id)
          ? cs
          : [
              ...cs,
              { id, orderDate: null, meal: null, headcount: null, dietary: null, supplierId: null, supplierName: null, costCents: null, notes: null },
            ],
      );
    });
  }

  function onRemoveCatering(id: string) {
    const prev = catering;
    setCatering((cs) => cs.filter((c) => c.id !== id));
    startTransition(() => void removeCateringOrder({ eventId, rowId: id }).catch(() => setCatering(prev)));
  }

  const roll = fnbRollup(
    vendors.map((v) => ({
      licence_status: v.licenceStatus,
      coi_status: v.coiStatus,
      permit_status: v.permitStatus,
      site_fee_cents: v.siteFeeCents,
      bond_cents: v.bondCents,
    })),
    catering.map((c) => ({ headcount: c.headcount, cost_cents: c.costCents })),
  );

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Tile label="Vendors" value={String(roll.vendorCount)} />
        <Tile label="Site fees (income)" value={formatCents(roll.siteFeesCents)} />
        <Tile label="Bonds held" value={formatCents(roll.bondsCents)} />
        <Tile
          label="Compliance outstanding"
          value={String(roll.complianceOutstanding)}
          tone={roll.complianceOutstanding > 0 ? "danger" : "success"}
        />
        <Tile label="Catering headcount" value={String(roll.cateringHeadcount)} />
        <Tile label="Catering cost" value={formatCents(roll.cateringCostCents)} />
      </section>

      {/* ---- Vendors ---- */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Vendors</h2>
        <div className="overflow-x-auto rounded-md border">
          <OptionDatalist id="zone-suggestions" values={zones} />
          <OptionDatalist id="fnb-type-suggestions" values={TYPE_SUGGESTIONS} />
          <table className="w-full min-w-[1500px] border-collapse text-sm">
            <thead className="bg-[var(--muted)]/60 text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                {[
                  "Supplier",
                  "Trading name",
                  "Type",
                  "Location",
                  "Frontage m",
                  "Power",
                  "Water",
                  "Waste",
                  "Arrival",
                  "Licence",
                  "COI",
                  "Permit",
                  "Site fee",
                  "Comm %",
                  "Bond",
                  "Payment",
                  "Notes",
                  "",
                ].map((h, i) => (
                  <th key={i} className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="group border-t align-top hover:bg-[var(--muted)]/40">
                  <td className="px-2 py-1 min-w-[150px]">
                    <SupplierSelect
                      supplierId={v.supplierId}
                      supplierName={v.supplierName}
                      suppliers={suppliers}
                      onChange={(sid) => editVendor(v.id, "supplierId", "supplier_id", sid, { supplierName: supplierName(sid) })}
                    />
                  </td>
                  <td className="px-2 py-1 min-w-[140px]">
                    <EditableCell value={v.tradingName} placeholder="—" onSave={(val) => editVendor(v.id, "tradingName", "trading_name", val)} />
                  </td>
                  <td className="px-2 py-1 min-w-[120px]">
                    <EditableCell value={v.vendorType} placeholder="—" listId="fnb-type-suggestions" onSave={(val) => editVendor(v.id, "vendorType", "vendor_type", val)} />
                  </td>
                  <td className="px-2 py-1 min-w-[120px]">
                    <EditableCell value={v.location} placeholder="—" listId="zone-suggestions" onSave={(val) => editVendor(v.id, "location", "location", val)} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <NumInput value={v.frontageM} onSave={(n) => editVendor(v.id, "frontageM", "frontage_m", n)} />
                  </td>
                  <td className="px-2 py-1 min-w-[110px]">
                    <EditableCell value={v.powerReq} placeholder="—" onSave={(val) => editVendor(v.id, "powerReq", "power_req", val)} />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={v.water} onChange={(e) => editVendor(v.id, "water", "water", e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--primary)]" />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={v.waste} onChange={(e) => editVendor(v.id, "waste", "waste", e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--primary)]" />
                  </td>
                  <td className="px-2 py-1 min-w-[150px]">
                    <div className="flex gap-1">
                      <input type="date" value={v.arrivalDate ?? ""} onChange={(e) => editVendor(v.id, "arrivalDate", "arrival_date", e.target.value || null)} className="h-8 rounded bg-transparent px-1 text-xs outline-none focus:bg-[var(--muted)]" />
                      <input type="time" value={v.arrivalTime ?? ""} onChange={(e) => editVendor(v.id, "arrivalTime", "arrival_time", e.target.value || null)} className="h-8 w-[72px] rounded bg-transparent px-1 text-xs tabular-nums outline-none focus:bg-[var(--muted)]" />
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <StatusButton field="compliance_status" value={v.licenceStatus} onCycle={(n) => editVendor(v.id, "licenceStatus", "licence_status", n)} />
                  </td>
                  <td className="px-2 py-1">
                    <StatusButton field="compliance_status" value={v.coiStatus} onCycle={(n) => editVendor(v.id, "coiStatus", "coi_status", n)} />
                  </td>
                  <td className="px-2 py-1">
                    <StatusButton field="compliance_status" value={v.permitStatus} onCycle={(n) => editVendor(v.id, "permitStatus", "permit_status", n)} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <MoneyCell cents={v.siteFeeCents ?? 0} onSave={(c) => editVendor(v.id, "siteFeeCents", "site_fee_cents", c)} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <NumInput value={v.commissionPct} onSave={(n) => editVendor(v.id, "commissionPct", "commission_pct", n)} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <MoneyCell cents={v.bondCents ?? 0} onSave={(c) => editVendor(v.id, "bondCents", "bond_cents", c)} />
                  </td>
                  <td className="px-2 py-1">
                    <StatusButton field="payment_status" value={v.paymentStatus} onCycle={(n) => editVendor(v.id, "paymentStatus", "payment_status", n)} />
                  </td>
                  <td className="px-2 py-1 min-w-[140px]">
                    <EditableCell value={v.notes} placeholder="—" onSave={(val) => editVendor(v.id, "notes", "notes", val)} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <RemoveButton label={v.tradingName ?? "vendor"} onClick={() => onRemoveVendor(v.id)} />
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={18} className="px-3 py-10 text-center text-[var(--muted-foreground)]">
                    No vendors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AddButton onClick={onAddVendor} label="Add vendor" />
      </section>

      {/* ---- Crew catering ---- */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Crew catering</h2>
        <div className="overflow-x-auto rounded-md border">
          <OptionDatalist id="fnb-meal-suggestions" values={MEAL_SUGGESTIONS} />
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-[var(--muted)]/60 text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                {["Date", "Meal", "Headcount", "Dietary", "Supplier", "Cost", "Notes", ""].map((h, i) => (
                  <th key={i} className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catering.map((c) => (
                <tr key={c.id} className="group border-t align-top hover:bg-[var(--muted)]/40">
                  <td className="px-2 py-1">
                    <input type="date" value={c.orderDate ?? ""} onChange={(e) => editCatering(c.id, "orderDate", "order_date", e.target.value || null)} className="h-8 rounded bg-transparent px-1 text-xs outline-none focus:bg-[var(--muted)]" />
                  </td>
                  <td className="px-2 py-1 min-w-[120px]">
                    <EditableCell value={c.meal} placeholder="—" listId="fnb-meal-suggestions" onSave={(val) => editCatering(c.id, "meal", "meal", val)} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <NumInput value={c.headcount} integer onSave={(n) => editCatering(c.id, "headcount", "headcount", n)} />
                  </td>
                  <td className="px-2 py-1 min-w-[160px]">
                    <EditableCell value={c.dietary} placeholder="—" onSave={(val) => editCatering(c.id, "dietary", "dietary", val)} />
                  </td>
                  <td className="px-2 py-1 min-w-[150px]">
                    <SupplierSelect
                      supplierId={c.supplierId}
                      supplierName={c.supplierName}
                      suppliers={suppliers}
                      onChange={(sid) => editCatering(c.id, "supplierId", "supplier_id", sid, { supplierName: supplierName(sid) })}
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <MoneyCell cents={c.costCents ?? 0} onSave={(money) => editCatering(c.id, "costCents", "cost_cents", money)} />
                  </td>
                  <td className="px-2 py-1 min-w-[140px]">
                    <EditableCell value={c.notes} placeholder="—" onSave={(val) => editCatering(c.id, "notes", "notes", val)} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <RemoveButton label={c.meal ?? "order"} onClick={() => onRemoveCatering(c.id)} />
                  </td>
                </tr>
              ))}
              {catering.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-[var(--muted-foreground)]">
                    No catering orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AddButton onClick={onAddCatering} label="Add catering order" />
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- cell helpers */

function Tile({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-md border bg-[var(--card)] p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</div>
      <div
        className={
          "mt-0.5 text-xl font-semibold tabular-nums " +
          (tone === "danger" ? "text-[var(--destructive)]" : tone === "success" ? "text-[var(--success)]" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function SupplierSelect({
  supplierId,
  supplierName,
  suppliers,
  onChange,
}: {
  supplierId: string | null;
  supplierName: string | null;
  suppliers: SupplierOpt[];
  onChange: (supplierId: string | null) => void;
}) {
  const inList = supplierId != null && suppliers.some((s) => s.id === supplierId);
  return (
    <select
      value={inList ? supplierId : ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={`w-full cursor-pointer rounded bg-transparent py-1 text-sm outline-none focus:bg-[var(--muted)] ${inList ? "" : "text-[var(--muted-foreground)]"}`}
    >
      <option value="">{(!inList && supplierName) || "—"}</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function MoneyCell({ cents, onSave }: { cents: number; onSave: (cents: number) => void }) {
  const toInput = (c: number) => (c / 100).toFixed(2);
  const [val, setVal] = useState(toInput(cents));
  const committed = useRef(cents);
  useEffect(() => {
    setVal(toInput(cents));
    committed.current = cents;
  }, [cents]);
  function commit() {
    const parsed = dollarsToCents(val) ?? 0;
    if (parsed !== committed.current) {
      committed.current = parsed;
      onSave(parsed);
    }
    setVal(toInput(parsed));
  }
  return (
    <input
      inputMode="decimal"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-24 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}

function NumInput({ value, integer, onSave }: { value: number | null; integer?: boolean; onSave: (v: number | null) => void }) {
  const toStr = (n: number | null) => (n == null ? "" : String(n));
  const [val, setVal] = useState(toStr(value));
  const committed = useRef(value);
  useEffect(() => {
    setVal(toStr(value));
    committed.current = value;
  }, [value]);
  function commit() {
    let next: number | null = null;
    if (val.trim() !== "") {
      const n = integer ? Math.trunc(Number(val)) : Number(val);
      next = Number.isFinite(n) ? n : null;
    }
    if (next !== committed.current) {
      committed.current = next;
      onSave(next);
    }
    setVal(toStr(next));
  }
  return (
    <input
      inputMode="decimal"
      value={val}
      placeholder="—"
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-16 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-[var(--muted)]"
    />
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Delete"
      aria-label={`Delete ${label}`}
      className="rounded p-1 text-[var(--muted-foreground)] opacity-0 transition hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] focus:opacity-100 group-hover:opacity-100"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
