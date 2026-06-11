/**
 * Quotes & invoices rollup for the event dashboard. Pure; reads raw snake_case
 * rows (lib/calc/infra.ts idiom). Money is inc-GST (matches actual_inc_gst_cents).
 */

type Row = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);

export interface InvoicesRollup {
  quoteCount: number;
  invoiceCount: number;
  invoicedIncGstCents: number;
  paidIncGstCents: number;
  /** Invoiced minus paid — what's still owed to suppliers. */
  outstandingIncGstCents: number;
}

export function invoicesRollup(rows: Row[]): InvoicesRollup {
  const invoiceRows = rows.filter((r) => r.kind === "invoice");
  const invoicedIncGstCents = invoiceRows.reduce((a, r) => a + num(r.amount_inc_gst_cents), 0);
  const paidIncGstCents = invoiceRows
    .filter((r) => r.status === "paid")
    .reduce((a, r) => a + num(r.amount_inc_gst_cents), 0);
  return {
    quoteCount: rows.filter((r) => r.kind === "quote").length,
    invoiceCount: invoiceRows.length,
    invoicedIncGstCents,
    paidIncGstCents,
    outstandingIncGstCents: invoicedIncGstCents - paidIncGstCents,
  };
}
