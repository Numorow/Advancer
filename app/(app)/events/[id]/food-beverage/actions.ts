"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { nextSort } from "@/lib/checklist/budget-sync";
import { STATUS_ORDER, type StatusField } from "@/lib/status";

/**
 * F&B field updates use one generic action per table (cf. the infra register
 * coerce-by-field-type approach) rather than a dozen typed actions. The field's
 * kind drives validation; statuses validate against STATUS_ORDER, suppliers
 * against the live (non-deleted) suppliers list.
 */

// The F&B tables post-date the generated Database types; until they're regen'd
// the typed client doesn't know them, so table calls go through this untyped
// view (same pattern as infrastructure/[register]/page.tsx).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

type FieldKind =
  | "text"
  | "money"
  | "int"
  | "numeric"
  | "date"
  | "time"
  | "bool"
  | "supplier"
  | `status:${StatusField}`;

const VENDOR_FIELDS: Record<string, FieldKind> = {
  trading_name: "text",
  vendor_type: "text",
  location: "text",
  power_req: "text",
  notes: "text",
  frontage_m: "numeric",
  commission_pct: "numeric",
  site_fee_cents: "money",
  bond_cents: "money",
  arrival_date: "date",
  arrival_time: "time",
  water: "bool",
  waste: "bool",
  licence_status: "status:compliance_status",
  coi_status: "status:compliance_status",
  permit_status: "status:compliance_status",
  payment_status: "status:payment_status",
  supplier_id: "supplier",
};

const CATERING_FIELDS: Record<string, FieldKind> = {
  order_date: "date",
  meal: "text",
  dietary: "text",
  notes: "text",
  headcount: "int",
  cost_cents: "money",
  supplier_id: "supplier",
};

type RawValue = string | number | boolean | null;

function coerceScalar(kind: FieldKind, value: RawValue): RawValue {
  if (kind.startsWith("status:")) {
    const order = STATUS_ORDER[kind.slice("status:".length) as StatusField];
    const v = String(value);
    if (!order.includes(v)) throw new Error("Invalid status value");
    return v;
  }
  switch (kind) {
    case "text": {
      const s = typeof value === "string" ? value.trim() : "";
      return s === "" ? null : s;
    }
    case "money": {
      if (value == null || value === "") return null;
      const n = Math.trunc(Number(value));
      if (!Number.isFinite(n) || n < 0 || n > 2_000_000_000) throw new Error("Invalid amount");
      return n;
    }
    case "int": {
      if (value == null || value === "") return null;
      const n = Math.trunc(Number(value));
      if (!Number.isFinite(n)) throw new Error("Invalid number");
      return n;
    }
    case "numeric": {
      if (value == null || value === "") return null;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error("Invalid number");
      return n;
    }
    case "date": {
      if (value == null || value === "") return null;
      const s = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid date");
      return s;
    }
    case "time": {
      if (value == null || value === "") return null;
      const s = String(value);
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(s)) throw new Error("Invalid time");
      return s;
    }
    case "bool":
      return Boolean(value);
    default:
      throw new Error(`Unhandled field kind: ${kind}`);
  }
}

async function coerceSupplier(value: RawValue, supabase: AnyClient): Promise<string | null> {
  if (value == null || value === "") return null;
  const id = String(value);
  const { data } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new Error("Supplier not found");
  return id;
}

function revalidateFnb(eventId: string) {
  revalidatePath(`/events/${eventId}/food-beverage`);
  revalidatePath(`/events/${eventId}`);
}

async function applyFieldUpdate(opts: {
  table: "fnb_vendors" | "fnb_catering_orders";
  entity: "fnb_vendor" | "fnb_catering_order";
  fields: Record<string, FieldKind>;
  id: string;
  eventId: string;
  field: string;
  value: RawValue;
}) {
  const ctx = await requireContext();
  const supabase = (await createClient()) as AnyClient;
  const kind = opts.fields[opts.field];
  if (!kind) throw new Error(`Unknown field: ${opts.field}`);

  const dbValue = kind === "supplier" ? await coerceSupplier(opts.value, supabase) : coerceScalar(kind, opts.value);

  const { error } = await supabase
    .from(opts.table)
    .update({ [opts.field]: dbValue, updated_at: new Date().toISOString() })
    .eq("id", opts.id)
    .eq("event_id", opts.eventId);
  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId: opts.eventId,
    actor: ctx.userId,
    entity: opts.entity,
    entityId: opts.id,
    action: `edit:${opts.field}`,
    after: { [opts.field]: dbValue },
  });
  revalidateFnb(opts.eventId);
  return { ok: true };
}

const FieldInput = z.object({
  eventId: z.string().uuid(),
  rowId: z.string().uuid(),
  field: z.string().max(64),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export async function updateVendorField(input: z.infer<typeof FieldInput>) {
  const { eventId, rowId, field, value } = FieldInput.parse(input);
  return applyFieldUpdate({
    table: "fnb_vendors",
    entity: "fnb_vendor",
    fields: VENDOR_FIELDS,
    id: rowId,
    eventId,
    field,
    value,
  });
}

export async function updateCateringField(input: z.infer<typeof FieldInput>) {
  const { eventId, rowId, field, value } = FieldInput.parse(input);
  return applyFieldUpdate({
    table: "fnb_catering_orders",
    entity: "fnb_catering_order",
    fields: CATERING_FIELDS,
    id: rowId,
    eventId,
    field,
    value,
  });
}

/* ----------------------------------------------------------------- add / remove */

async function addRow(table: "fnb_vendors" | "fnb_catering_orders", entity: string, eventId: string) {
  const ctx = await requireContext();
  const supabase = (await createClient()) as AnyClient;
  const { data: siblings } = await supabase.from(table).select("sort").eq("event_id", eventId).is("deleted_at", null);
  const sort = nextSort(siblings ?? []);
  const { data, error } = await supabase
    .from(table)
    .insert({ event_id: eventId, sort })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add row");
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity, entityId: data.id, action: "create" });
  revalidateFnb(eventId);
  return { id: data.id as string };
}

async function removeRow(table: "fnb_vendors" | "fnb_catering_orders", entity: string, eventId: string, rowId: string) {
  const ctx = await requireContext();
  const supabase = (await createClient()) as AnyClient;
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", rowId)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity, entityId: rowId, action: "archive" });
  revalidateFnb(eventId);
  return { ok: true };
}

const AddInput = z.object({ eventId: z.string().uuid() });
const RemoveInput = z.object({ eventId: z.string().uuid(), rowId: z.string().uuid() });

export async function addVendor(input: z.infer<typeof AddInput>) {
  return addRow("fnb_vendors", "fnb_vendor", AddInput.parse(input).eventId);
}
export async function removeVendor(input: z.infer<typeof RemoveInput>) {
  const { eventId, rowId } = RemoveInput.parse(input);
  return removeRow("fnb_vendors", "fnb_vendor", eventId, rowId);
}
export async function addCateringOrder(input: z.infer<typeof AddInput>) {
  return addRow("fnb_catering_orders", "fnb_catering_order", AddInput.parse(input).eventId);
}
export async function removeCateringOrder(input: z.infer<typeof RemoveInput>) {
  const { eventId, rowId } = RemoveInput.parse(input);
  return removeRow("fnb_catering_orders", "fnb_catering_order", eventId, rowId);
}
