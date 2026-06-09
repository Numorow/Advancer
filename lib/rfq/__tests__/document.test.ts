import { describe, it, expect } from "vitest";
import { buildRfqEmail, formatItemLine } from "../document";

const baseRfq = {
  rfqNo: "RFQ-12",
  title: "Staging & rigging",
  deliveryDate: "2026-08-01",
  collectionDate: "2026-08-10",
  responseDueDate: "2026-07-15",
  location: "Main arena",
  notes: "Forklift access via gate 3.",
};

describe("formatItemLine", () => {
  it("combines qty + unit + description", () => {
    expect(formatItemLine({ description: "Decks", quantity: "3", unit: "pallets" })).toBe("3 pallets — Decks");
  });
  it("falls back to description alone", () => {
    expect(formatItemLine({ description: "Decks", quantity: null, unit: null })).toBe("Decks");
  });
});

describe("buildRfqEmail", () => {
  it("builds a referenced subject and an addressed, itemised body", () => {
    const { subject, body } = buildRfqEmail({
      rfq: baseRfq,
      items: [
        { description: "Stage decks", quantity: "12", unit: "m²" },
        { description: "Truss", quantity: null, unit: null },
      ],
      recipient: { supplierName: "Perth Hire", contactName: "Sam" },
      orgName: "Kyron Pty Ltd",
      eventName: "Calcio 2026",
    });
    expect(subject).toBe("RFQ RFQ-12 — Staging & rigging (Calcio 2026)");
    expect(body).toContain("Hi Sam,");
    expect(body).toContain("12 m² — Stage decks");
    expect(body).toContain("Truss");
    expect(body).toContain("Delivery date: 2026-08-01");
    expect(body).toContain("Location: Main arena");
    expect(body).toContain("by 2026-07-15");
    expect(body).toContain("Kyron Pty Ltd");
  });

  it("greets generically and softens the due date when details are missing", () => {
    const { subject, body } = buildRfqEmail({
      rfq: { ...baseRfq, rfqNo: null, responseDueDate: null, location: null, notes: null },
      items: [],
      recipient: null,
      orgName: "Kyron Pty Ltd",
      eventName: "Calcio 2026",
    });
    expect(subject).toBe("RFQ — Staging & rigging (Calcio 2026)");
    expect(body).toContain("Hi there,");
    expect(body).toContain("at your earliest convenience");
    expect(body).not.toContain("Location:");
  });
});
