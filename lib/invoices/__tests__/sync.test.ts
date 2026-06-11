import { describe, it, expect } from "vitest";
import { deriveLineFromInvoices, lineHasInvoices, type InvoiceLine } from "../sync";

const inv = (amountIncGstCents: number | null, status = "received"): InvoiceLine => ({
  kind: "invoice",
  amountIncGstCents,
  status,
});
const quote = (amountIncGstCents: number | null): InvoiceLine => ({ kind: "quote", amountIncGstCents, status: "received" });

describe("deriveLineFromInvoices", () => {
  it("no invoices → 0 / unpaid (line reverts to manual)", () => {
    expect(deriveLineFromInvoices([])).toEqual({ actualIncGstCents: 0, paymentStatus: "unpaid" });
    expect(deriveLineFromInvoices([quote(50000)])).toEqual({ actualIncGstCents: 0, paymentStatus: "unpaid" });
  });

  it("sums invoice inc-GST amounts and ignores quotes", () => {
    const d = deriveLineFromInvoices([inv(40000), inv(15000), quote(99999)]);
    expect(d.actualIncGstCents).toBe(55000);
  });

  it("payment: none paid → unpaid", () => {
    expect(deriveLineFromInvoices([inv(100, "received"), inv(200, "approved")]).paymentStatus).toBe("unpaid");
  });

  it("payment: some paid → partial", () => {
    expect(deriveLineFromInvoices([inv(100, "paid"), inv(200, "received")]).paymentStatus).toBe("partial");
  });

  it("payment: all paid → paid", () => {
    expect(deriveLineFromInvoices([inv(100, "paid"), inv(200, "paid")]).paymentStatus).toBe("paid");
  });

  it("treats null amounts as 0 and coerces numeric strings", () => {
    const d = deriveLineFromInvoices([inv(null, "paid"), { kind: "invoice", amountIncGstCents: "12345" as unknown as number, status: "paid" }]);
    expect(d.actualIncGstCents).toBe(12345);
    expect(d.paymentStatus).toBe("paid");
  });

  it("lineHasInvoices ignores quote-only lines", () => {
    expect(lineHasInvoices([quote(1)])).toBe(false);
    expect(lineHasInvoices([quote(1), inv(2)])).toBe(true);
  });
});
