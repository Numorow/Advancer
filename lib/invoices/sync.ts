/**
 * Invoices → budget line sync. Invoices are the source of truth for a budget
 * line's actual cost + payment: their inc-GST amounts feed actual_inc_gst_cents
 * and their paid/unpaid states derive the line's payment_status. Quotes are
 * stored reference-only and never affect the line. Mirrors the checklist↔budget
 * mirror precedent in lib/checklist/sync.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface InvoiceLine {
  kind: string; // 'quote' | 'invoice'
  amountIncGstCents: number | null;
  status: string; // invoice_status: received | approved | paid
}

export interface DerivedBudgetLine {
  actualIncGstCents: number;
  paymentStatus: "unpaid" | "partial" | "paid";
}

const num = (v: unknown): number => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);

/**
 * Pure: what a budget line's actual + payment should be, given its invoices.
 * Only `kind === 'invoice'` rows count; quotes are ignored. No invoices → the
 * line reverts to a clean manual state (0 / unpaid).
 */
export function deriveLineFromInvoices(rows: InvoiceLine[]): DerivedBudgetLine {
  const invoices = rows.filter((r) => r.kind === "invoice");
  if (invoices.length === 0) return { actualIncGstCents: 0, paymentStatus: "unpaid" };

  const actualIncGstCents = invoices.reduce((a, r) => a + num(r.amountIncGstCents), 0);
  const paid = invoices.filter((r) => r.status === "paid").length;
  const paymentStatus = paid === 0 ? "unpaid" : paid === invoices.length ? "paid" : "partial";
  return { actualIncGstCents, paymentStatus };
}

/**
 * Recompute a budget line's actual + payment from its live invoices and write
 * them onto budget_items. Call after any invoice add/remove or amount/status/
 * kind change. No-op when there's no budget line linked.
 */
export async function syncBudgetLineFromInvoices(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  budgetItemId: string | null,
): Promise<void> {
  if (!budgetItemId) return;
  const { data } = await supabase
    .from("invoices")
    .select("kind, amount_inc_gst_cents, status")
    .eq("budget_item_id", budgetItemId)
    .is("deleted_at", null);

  const derived = deriveLineFromInvoices(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((r: any) => ({
      kind: r.kind,
      amountIncGstCents: r.amount_inc_gst_cents,
      status: r.status,
    })),
  );

  await supabase
    .from("budget_items")
    .update({
      actual_inc_gst_cents: derived.actualIncGstCents,
      payment_status: derived.paymentStatus,
    })
    .eq("id", budgetItemId);
}

/** True once a line has any invoice — drives the Budget grid's read-only actual/payment. */
export function lineHasInvoices(rows: InvoiceLine[]): boolean {
  return rows.some((r) => r.kind === "invoice");
}
