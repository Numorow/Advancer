import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { toPdf, toEventPackPdf } from "../pdf";
import { toRfqPdf } from "@/lib/rfq/pdf";
import { ADVANCER_MARK } from "../branding";
import type { ReportData } from "../types";

// Dev harness: render representative PDFs to /tmp/advancer-pdfs for visual
// inspection (fit-to-page, logo, details). The mark stands in for the event
// cover image (real path: loadEventImage downloads the cover). Always asserts
// a valid PDF so it's a real test too.
const OUT = "/tmp/advancer-pdfs";
const branding = { mark: ADVANCER_MARK, eventImage: ADVANCER_MARK };
const EVENT = "Calcio Italiano 2027 — Marvel Stadium";

const rows = (n: number, make: (i: number) => Record<string, string | number>) =>
  Array.from({ length: n }, (_, i) => make(i));

const suppliers: ReportData = {
  title: "Supplier directory",
  subtitle: "112 suppliers · sorted by name",
  columns: [
    { key: "name", label: "Name" },
    { key: "contact", label: "Contact" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "abn", label: "ABN" },
    { key: "ins", label: "Insurance", align: "center" },
    { key: "pref", label: "Preferred", align: "center" },
    { key: "cats", label: "Categories" },
  ],
  rows: rows(34, (i) => ({
    name: `Melbourne Event Infrastructure & Staging Co Pty Ltd ${i + 1}`,
    contact: "Alexandria Featherstonehaugh",
    email: `accounts.payable.${i + 1}@melbourneeventinfrastructure.com.au`,
    phone: "+61 3 9876 5432",
    abn: "12 345 678 901",
    ins: i % 2 ? "Yes" : "No",
    pref: i % 3 ? "" : "★",
    cats: "Power / Electricians, Fencing, Staging, Marquees, Furniture",
  })),
};

const crewCost: ReportData = {
  title: "Crew cost",
  columns: [
    { key: "date", label: "Date" },
    { key: "role", label: "Role" },
    { key: "qty", label: "Qty", align: "right" },
    { key: "person", label: "Person" },
    { key: "start", label: "Start" },
    { key: "finish", label: "Finish" },
    { key: "sched", label: "Sched hrs", align: "right" },
    { key: "actual", label: "Actual hrs", align: "right" },
    { key: "rate", label: "Rate", align: "right" },
    { key: "total", label: "Total", align: "right" },
  ],
  rows: rows(45, (i) => ({
    date: "2027-03-1" + (i % 9),
    role: "Senior Site Supervisor / Crew Lead",
    qty: 2,
    person: "Christopher Papadopoulos",
    start: "06:00",
    finish: "18:30",
    sched: "12.5",
    actual: "13.0",
    rate: "$85.00",
    total: "$2,210.00",
  })),
  totals: { date: "Total", sched: "562.5", actual: "585.0", total: "$99,450.00" },
};

const schedule: ReportData = {
  title: "Master schedule",
  columns: [
    { key: "date", label: "Date" },
    { key: "start", label: "Start" },
    { key: "finish", label: "Finish" },
    { key: "type", label: "Type" },
    { key: "supplier", label: "Supplier" },
    { key: "action", label: "Action" },
    { key: "loc", label: "Location" },
    { key: "poc", label: "Site POC" },
    { key: "done", label: "Done", align: "center" },
  ],
  rows: rows(30, (i) => ({
    date: "2027-03-12",
    start: "07:00",
    finish: "09:30",
    type: "BUMP_IN",
    supplier: "Melbourne Event Infrastructure Pty Ltd",
    action: `Deliver and install ${10 + i}x 3m running fence with shadecloth along the eastern boundary`,
    loc: "Gate 3 / Eastern concourse",
    poc: "Site Manager",
    done: i % 2 ? "✓" : "",
  })),
};

describe("PDF render samples", () => {
  it("renders branded, paginated PDFs to /tmp for inspection", async () => {
    mkdirSync(OUT, { recursive: true });
    const single: [string, ReportData][] = [
      ["suppliers", suppliers],
      ["crew-cost", crewCost],
      ["master-schedule", schedule],
    ];
    for (const [name, data] of single) {
      const buf = await toPdf(data, EVENT, branding);
      writeFileSync(`${OUT}/${name}.pdf`, buf);
      expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    }

    const pack = await toEventPackPdf([suppliers, crewCost, schedule], EVENT, branding);
    writeFileSync(`${OUT}/event-pack.pdf`, pack);
    expect(pack.length).toBeGreaterThan(3000);

    const rfq = await toRfqPdf({
      rfq: {
        rfqNo: "RFQ-007",
        title: "Perimeter fencing & crowd barrier supply for the eastern concourse",
        deliveryDate: "2027-03-11",
        collectionDate: "2027-03-16",
        responseDueDate: "2027-02-20",
        location: "Marvel Stadium, Docklands — Gate 3 loading dock",
        notes: "Please quote ex-GST. Include weekend bump-out labour and any traffic management.",
      },
      items: rows(8, (i) => ({
        description: `3.0m × 2.1m temporary fence panel with rubber feet and anti-climb mesh — run ${i + 1}`,
        quantity: String(40 + i),
        unit: "panels",
      })) as { description: string; quantity: string; unit: string }[],
      recipient: { supplierName: "Melbourne Event Infrastructure Pty Ltd", contactName: "Alexandria Featherstonehaugh" },
      orgName: "Kyron Event Solutions",
      eventName: EVENT,
      branding,
    });
    writeFileSync(`${OUT}/rfq.pdf`, rfq);
    expect(rfq.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
