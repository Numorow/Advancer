import { describe, it, expect } from "vitest";
import { invoicesRollup } from "../invoices";

const row = (kind: string, amount_inc_gst_cents: number | null, status = "received") => ({
  kind,
  amount_inc_gst_cents,
  status,
});

describe("invoicesRollup", () => {
  it("zeros for empty input", () => {
    expect(invoicesRollup([])).toEqual({
      quoteCount: 0,
      invoiceCount: 0,
      invoicedIncGstCents: 0,
      paidIncGstCents: 0,
      outstandingIncGstCents: 0,
    });
  });

  it("totals invoices, counts quotes separately, and computes outstanding", () => {
    const r = invoicesRollup([
      row("invoice", 50000, "paid"),
      row("invoice", 30000, "received"),
      row("quote", 99999),
      row("quote", 12345),
    ]);
    expect(r.invoiceCount).toBe(2);
    expect(r.quoteCount).toBe(2);
    expect(r.invoicedIncGstCents).toBe(80000);
    expect(r.paidIncGstCents).toBe(50000);
    expect(r.outstandingIncGstCents).toBe(30000);
  });

  it("excludes quotes from money totals and handles nulls", () => {
    const r = invoicesRollup([row("invoice", null, "paid"), row("quote", 9999, "paid")]);
    expect(r.invoicedIncGstCents).toBe(0);
    expect(r.paidIncGstCents).toBe(0);
    expect(r.outstandingIncGstCents).toBe(0);
  });
});
