"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { nextSort } from "@/lib/checklist/budget-sync";
import { STATUS_ORDER } from "@/lib/status";
import { syncBudgetLineFromInvoices } from "@/lib/invoices/sync";

// The invoices table post-dates the generated Database types — read/write it
// untyped until they're regenerated (same pattern as the infra register page).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

function revalidateInvoices(eventId: string) {
  revalidatePath(`/events/${eventId}/invoices`);
  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}`);
}

/* --------------------------------------------------------------------- add */

const AddInput = z.object({
  eventId: z.string().uuid(),
  kind: z.enum(["quote", "invoice"]),
  budgetItemId: z.string().uuid().nullable().optional(),
});

export async function addInvoice(input: z.infer<typeof AddInput>) {
  const ctx = await requireContext();
  const { eventId, kind, budgetItemId } = AddInput.parse(input);
  const supabase = (await createClient()) as AnyClient;

  // Default the supplier to whoever owns the linked budget line.
  let supplierId: string | null = null;
  if (budgetItemId) {
    const { data: line } = await supabase
      .from("budget_items")
      .select("supplier_id")
      .eq("id", budgetItemId)
      .eq("event_id", eventId)
      .maybeSingle();
    supplierId = line?.supplier_id ?? null;
  }

  const { data: siblings } = await supabase.from("invoices").select("sort").eq("event_id", eventId).is("deleted_at", null);
  const sort = nextSort(siblings ?? []);

  const { data, error } = await supabase
    .from("invoices")
    .insert({ event_id: eventId, kind, budget_item_id: budgetItemId ?? null, supplier_id: supplierId, sort })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add invoice");

  await syncBudgetLineFromInvoices(supabase, budgetItemId ?? null);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "invoice", entityId: data.id, action: "create", after: { kind } });
  revalidateInvoices(eventId);
  return { id: data.id as string };
}

/* ------------------------------------------------------------------ update */

type FieldKind = "text" | "url" | "money" | "date" | "status" | "supplier" | "budget" | "kind";

const FIELDS: Record<string, FieldKind> = {
  reference: "text",
  notes: "text",
  external_url: "url",
  amount_inc_gst_cents: "money",
  issued_date: "date",
  due_date: "date",
  status: "status",
  supplier_id: "supplier",
  budget_item_id: "budget",
  kind: "kind",
};

const FieldInput = z.object({
  eventId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  field: z.string().max(40),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export async function updateInvoiceField(input: z.infer<typeof FieldInput>) {
  const ctx = await requireContext();
  const { eventId, invoiceId, field, value } = FieldInput.parse(input);
  const kind = FIELDS[field];
  if (!kind) throw new Error(`Unknown field: ${field}`);
  const supabase = (await createClient()) as AnyClient;

  const { data: row } = await supabase
    .from("invoices")
    .select("kind, budget_item_id")
    .eq("id", invoiceId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!row) throw new Error("Invoice not found");
  const oldBudgetItemId: string | null = row.budget_item_id;

  const patch: Record<string, unknown> = {};

  if (kind === "text") {
    const s = typeof value === "string" ? value.trim() : "";
    patch[field] = s === "" ? null : s;
  } else if (kind === "url") {
    const s = typeof value === "string" ? value.trim() : "";
    if (s && !/^https?:\/\//i.test(s)) throw new Error("Links must start with http(s)://");
    patch[field] = s === "" ? null : s;
  } else if (kind === "money") {
    if (value == null || value === "") patch[field] = null;
    else {
      const n = Math.trunc(Number(value));
      if (!Number.isFinite(n) || n < 0 || n > 2_000_000_000) throw new Error("Invalid amount");
      patch[field] = n;
    }
  } else if (kind === "date") {
    if (value == null || value === "") patch[field] = null;
    else {
      const s = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid date");
      patch[field] = s;
    }
  } else if (kind === "status") {
    const order = STATUS_ORDER[row.kind === "invoice" ? "invoice_status" : "quote_status"];
    const v = String(value);
    if (!order.includes(v)) throw new Error("Invalid status");
    patch.status = v;
  } else if (kind === "kind") {
    const v = String(value);
    if (v !== "quote" && v !== "invoice") throw new Error("Invalid kind");
    patch.kind = v;
    patch.status = "received"; // statuses differ per kind — reset to the shared start
  } else if (kind === "supplier") {
    if (value == null || value === "") patch.supplier_id = null;
    else {
      const id = String(value);
      const { data: sup } = await supabase.from("suppliers").select("id").eq("id", id).is("deleted_at", null).maybeSingle();
      if (!sup) throw new Error("Supplier not found");
      patch.supplier_id = id;
    }
  } else if (kind === "budget") {
    if (value == null || value === "") patch.budget_item_id = null;
    else {
      const id = String(value);
      const { data: line } = await supabase.from("budget_items").select("id").eq("id", id).eq("event_id", eventId).maybeSingle();
      if (!line) throw new Error("Budget line not found");
      patch.budget_item_id = id;
    }
  }

  const { error } = await supabase.from("invoices").update(patch).eq("id", invoiceId).eq("event_id", eventId);
  if (error) throw new Error(error.message);

  // Keep the budget line(s) in sync. A budget-line change re-syncs both old + new.
  const newBudgetItemId = "budget_item_id" in patch ? (patch.budget_item_id as string | null) : oldBudgetItemId;
  await syncBudgetLineFromInvoices(supabase, newBudgetItemId);
  if ("budget_item_id" in patch && oldBudgetItemId && oldBudgetItemId !== newBudgetItemId) {
    await syncBudgetLineFromInvoices(supabase, oldBudgetItemId);
  }

  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "invoice", entityId: invoiceId, action: `edit:${field}`, after: patch });
  revalidateInvoices(eventId);
  return { ok: true };
}

/* ------------------------------------------------------------- file upload */

export async function setInvoiceFile(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireContext();
  const eventId = String(formData.get("eventId") ?? "");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const file = formData.get("file");
  if (!z.string().uuid().safeParse(eventId).success || !z.string().uuid().safeParse(invoiceId).success) {
    return { error: "Bad request." };
  }
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (file.size > 20 * 1024 * 1024) return { error: "File is over 20MB." };

  const supabase = (await createClient()) as AnyClient;
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const filePath = `${eventId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("event-docs")
    .upload(filePath, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { error: "Upload failed." };

  // Replace any previous file, and clear an external link (file wins).
  const { data: prev } = await supabase.from("invoices").select("file_path").eq("id", invoiceId).maybeSingle();
  const { error } = await supabase
    .from("invoices")
    .update({ file_path: filePath, external_url: null })
    .eq("id", invoiceId)
    .eq("event_id", eventId);
  if (error) return { error: error.message };
  if (prev?.file_path) await supabase.storage.from("event-docs").remove([prev.file_path]);

  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "invoice", entityId: invoiceId, action: "edit:file" });
  revalidateInvoices(eventId);
  return { ok: true };
}

/* ------------------------------------------------------------------ remove */

const RemoveInput = z.object({ eventId: z.string().uuid(), invoiceId: z.string().uuid() });

export async function removeInvoice(input: z.infer<typeof RemoveInput>) {
  const ctx = await requireContext();
  const { eventId, invoiceId } = RemoveInput.parse(input);
  const supabase = (await createClient()) as AnyClient;

  const { data: row } = await supabase.from("invoices").select("budget_item_id, file_path").eq("id", invoiceId).maybeSingle();
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  if (row?.file_path) await supabase.storage.from("event-docs").remove([row.file_path]);

  await syncBudgetLineFromInvoices(supabase, row?.budget_item_id ?? null);
  await writeAudit(supabase, { orgId: ctx.orgId, eventId, actor: ctx.userId, entity: "invoice", entityId: invoiceId, action: "archive" });
  revalidateInvoices(eventId);
  return { ok: true };
}
