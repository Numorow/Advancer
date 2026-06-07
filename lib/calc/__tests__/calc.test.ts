import { describe, it, expect } from "vitest";
import {
  GST_RATE,
  gstFromExCents,
  incFromExCents,
  exFromIncCents,
  gstFromIncCents,
  dollarsToCents,
  formatCents,
} from "../money";
import { rollupBudget, rollupByCategory, type BudgetLine } from "../budget";
import { parseWorkbookTime, parseExcelDate, toISODate } from "../time";
import { safeRatio, capacityRatio } from "../ratio";
import { eventDashboard } from "../dashboard";

describe("money / GST", () => {
  it("uses 10% GST", () => {
    expect(GST_RATE).toBe(0.1);
    expect(gstFromExCents(10000)).toBe(1000);
    expect(incFromExCents(10000)).toBe(11000);
  });

  it("rounds GST to the nearest cent", () => {
    // $3,443.50 ex -> $344.35 GST
    expect(gstFromExCents(344350)).toBe(34435);
    // odd cent: 1 cent ex -> rounds to 0 GST
    expect(gstFromExCents(1)).toBe(0);
    expect(gstFromExCents(5)).toBe(1); // 0.5 rounds up
  });

  it("round-trips ex <-> inc", () => {
    expect(exFromIncCents(11000)).toBe(10000);
    expect(gstFromIncCents(11000)).toBe(1000);
    expect(exFromIncCents(incFromExCents(123456))).toBe(123456);
  });

  it("parses dollar inputs into cents and rejects junk", () => {
    expect(dollarsToCents("34,433.50")).toBe(3443350);
    expect(dollarsToCents("$1,000")).toBe(100000);
    expect(dollarsToCents(125)).toBe(12500);
    expect(dollarsToCents(-50.5)).toBe(-5050);
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents(null)).toBeNull();
    // spreadsheet error strings must never become a number
    expect(dollarsToCents("#REF!")).toBeNull();
    expect(dollarsToCents("#VALUE!")).toBeNull();
    expect(dollarsToCents("#DIV/0!")).toBeNull();
    expect(dollarsToCents(Infinity)).toBeNull();
  });

  it("formats AUD", () => {
    expect(formatCents(3443350)).toBe("$34,433.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(12500, { showSign: true })).toBe("+$125.00");
    expect(formatCents(-5050)).toBe("-$50.50");
  });
});

describe("budget rollups", () => {
  const items: BudgetLine[] = [
    { quotedExGstCents: 1000000, actualIncGstCents: 0, approvalStatus: "approved", paymentStatus: "unpaid" },
    { quotedExGstCents: 500000, actualIncGstCents: 550000, approvalStatus: "approved", paymentStatus: "paid" },
    { quotedExGstCents: 250000, actualIncGstCents: 0, approvalStatus: "pending", paymentStatus: "unpaid" },
  ];

  it("totals quoted ex/gst/inc and actuals", () => {
    const r = rollupBudget(items);
    expect(r.quotedExGstCents).toBe(1750000);
    expect(r.quotedGstCents).toBe(175000);
    expect(r.quotedIncGstCents).toBe(1925000);
    expect(r.actualIncGstCents).toBe(550000);
  });

  it("variance is actual inc minus quoted inc (negative = under)", () => {
    const r = rollupBudget(items);
    expect(r.varianceCents).toBe(550000 - 1925000);
    expect(r.varianceCents).toBeLessThan(0);
  });

  it("commits only approved quoted and counts only paid actuals", () => {
    const r = rollupBudget(items);
    expect(r.committedExGstCents).toBe(1500000);
    expect(r.paidIncGstCents).toBe(550000);
  });

  it("handles an empty budget without NaN", () => {
    const r = rollupBudget([]);
    expect(r.quotedIncGstCents).toBe(0);
    expect(r.varianceCents).toBe(0);
    expect(r.count).toBe(0);
  });

  it("groups by category", () => {
    const groups = rollupByCategory(
      [
        { quotedExGstCents: 100, actualIncGstCents: 0, cat: "power" },
        { quotedExGstCents: 200, actualIncGstCents: 0, cat: "power" },
        { quotedExGstCents: 50, actualIncGstCents: 0, cat: "fencing" },
      ] as (BudgetLine & { cat: string })[],
      (i) => i.cat,
    );
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.key === "power")!.rollup.quotedExGstCents).toBe(300);
  });
});

describe("workbook time normalisation", () => {
  it("parses 12h am/pm", () => {
    expect(parseWorkbookTime("8:00AM")).toBe("08:00");
    expect(parseWorkbookTime("4:00PM")).toBe("16:00");
    expect(parseWorkbookTime("12:00AM")).toBe("00:00");
    expect(parseWorkbookTime("12:00PM")).toBe("12:00");
    expect(parseWorkbookTime("9 am")).toBe("09:00");
  });

  it("parses 24h strings", () => {
    expect(parseWorkbookTime("18:30")).toBe("18:30");
    expect(parseWorkbookTime("7:05")).toBe("07:05");
  });

  it("parses integer clock values (700 / 1800)", () => {
    expect(parseWorkbookTime(700)).toBe("07:00");
    expect(parseWorkbookTime(1800)).toBe("18:00");
    expect(parseWorkbookTime("0700")).toBe("07:00");
    expect(parseWorkbookTime("1830")).toBe("18:30");
  });

  it("parses Excel day fractions", () => {
    expect(parseWorkbookTime(0.5)).toBe("12:00");
    expect(parseWorkbookTime(0.25)).toBe("06:00");
  });

  it("reads time from a Date", () => {
    expect(parseWorkbookTime(new Date(Date.UTC(1899, 11, 31, 8, 30)))).toBe("08:30");
  });

  it("returns null for blanks and garbage", () => {
    expect(parseWorkbookTime("")).toBeNull();
    expect(parseWorkbookTime(null)).toBeNull();
    expect(parseWorkbookTime("TBC")).toBeNull();
    expect(parseWorkbookTime(9999)).toBeNull();
  });
});

describe("excel dates", () => {
  it("converts serials and round-trips to ISO", () => {
    // 1 Aug 2026 == Excel serial 46235
    expect(toISODate(parseExcelDate(46235))).toBe("2026-08-01");
    expect(toISODate(parseExcelDate(new Date(Date.UTC(2026, 7, 1))))).toBe("2026-08-01");
    expect(parseExcelDate("")).toBeNull();
    expect(toISODate(null)).toBeNull();
  });
});

describe("ratio guards (no #DIV/0!)", () => {
  it("returns null instead of dividing by zero", () => {
    expect(safeRatio(10, 0)).toBeNull();
    expect(capacityRatio(500, 0)).toBeNull();
    expect(capacityRatio(500, -2)).toBeNull();
  });
  it("computes a real ratio when valid", () => {
    expect(safeRatio(100, 4)).toBe(25);
    expect(capacityRatio(600, 6)).toBe(100);
  });
});

describe("event dashboard", () => {
  it("rolls budget, checklist and schedule together", () => {
    const d = eventDashboard(
      [{ quotedExGstCents: 100000, actualIncGstCents: 0 }],
      [
        { status: "done", rfqStatus: "sent", bookingStatus: "booked", paymentStatus: "paid" },
        { status: "not_started", rfqStatus: "not_sent", bookingStatus: "not_booked", paymentStatus: "unpaid" },
        { status: "in_progress", rfqStatus: "sent", bookingStatus: "booked", paymentStatus: "unpaid" },
      ],
      [
        { eventDate: "2026-08-01", completed: false },
        { eventDate: "2026-08-02", completed: true },
      ],
      "2026-08-01",
    );
    expect(d.budget.quotedIncGstCents).toBe(110000);
    expect(d.checklist.pct).toBe(33);
    expect(d.checklist.rfqOutstanding).toBe(1);
    expect(d.checklist.unbooked).toBe(1);
    expect(d.checklist.unpaidBooked).toBe(1);
    expect(d.schedule.dueToday).toBe(1);
    expect(d.schedule.completed).toBe(1);
  });
});
