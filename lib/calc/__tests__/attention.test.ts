import { describe, it, expect } from "vitest";
import {
  attentionBadge,
  attentionForEvent,
  isActiveEvent,
  type AttentionInputs,
} from "../attention";

const TODAY = "2026-06-10";
const EMPTY: AttentionInputs = { checklist: [], rfqs: [], schedule: [], management: [] };

const checklistRow = (over: Partial<AttentionInputs["checklist"][number]> = {}) => ({
  item: "Book toilets",
  dueDate: null,
  status: "in_progress",
  bookingStatus: "not_booked",
  paymentStatus: "unpaid",
  ...over,
});

describe("attentionForEvent", () => {
  it("returns nothing when everything is fine", () => {
    expect(attentionForEvent("e1", EMPTY, TODAY)).toEqual([]);
  });

  it("flags open critical-path entries for today or earlier as danger", () => {
    const items = attentionForEvent(
      "e1",
      {
        ...EMPTY,
        schedule: [
          { action: "Crane lift", eventDate: "2026-06-09", completed: false, criticalPath: true },
          { action: "Done lift", eventDate: "2026-06-09", completed: true, criticalPath: true },
          { action: "Future lift", eventDate: "2026-07-01", completed: false, criticalPath: true },
          { action: "Undated lift", eventDate: null, completed: false, criticalPath: true },
        ],
      },
      TODAY,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ severity: "danger", kind: "critical-open", label: "Crane lift" });
  });

  it("flags non-critical entries scheduled today as info", () => {
    const items = attentionForEvent(
      "e1",
      { ...EMPTY, schedule: [{ action: "Deliver fencing", eventDate: TODAY, completed: false, criticalPath: false }] },
      TODAY,
    );
    expect(items[0]).toMatchObject({ severity: "info", kind: "schedule-today" });
  });

  it("flags overdue checklist items and booked-but-unpaid lines", () => {
    const items = attentionForEvent(
      "e1",
      {
        ...EMPTY,
        checklist: [
          checklistRow({ dueDate: "2026-06-01" }),
          checklistRow({ item: "Stage", bookingStatus: "booked", paymentStatus: "unpaid" }),
          checklistRow({ item: "Done thing", dueDate: "2026-06-01", status: "done" }),
          checklistRow({ item: "Paid thing", bookingStatus: "booked", paymentStatus: "paid" }),
        ],
      },
      TODAY,
    );
    expect(items.map((i) => i.kind)).toEqual(["checklist-overdue", "booked-unpaid"]);
  });

  it("flags RFQs past their quote-due date that still await responses", () => {
    const rfq = (over: Partial<AttentionInputs["rfqs"][number]>) => ({
      title: "Generators",
      rfqNo: "012",
      status: "sent",
      responseDueDate: "2026-06-01",
      recipients: [{ status: "sent" }],
      ...over,
    });
    const items = attentionForEvent(
      "e1",
      {
        ...EMPTY,
        rfqs: [
          rfq({}),
          rfq({ title: "All responded", recipients: [{ status: "responded" }] }),
          rfq({ title: "Awarded", status: "awarded" }),
          rfq({ title: "Not due yet", responseDueDate: "2026-07-01" }),
        ],
      },
      TODAY,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ severity: "warning", kind: "rfq-overdue", label: "012 — Generators" });
  });

  it("flags overdue management tasks and sorts danger before warning before info", () => {
    const items = attentionForEvent(
      "e1",
      {
        checklist: [checklistRow({ item: "Unpaid", bookingStatus: "booked", paymentStatus: "unpaid" })],
        rfqs: [],
        schedule: [{ action: "Critical", eventDate: "2026-06-01", completed: false, criticalPath: true }],
        management: [
          { task: "Site induction plan", weekDate: "2026-06-01", completed: false },
          { task: "Done task", weekDate: "2026-06-01", completed: true },
        ],
      },
      TODAY,
    );
    expect(items.map((i) => i.severity)).toEqual(["danger", "warning", "info"]);
    expect(items[1]).toMatchObject({ kind: "management-overdue", label: "Site induction plan" });
  });
});

describe("attentionBadge", () => {
  it("hides at zero, shows exact counts, caps at 9+", () => {
    expect(attentionBadge(0)).toBeNull();
    expect(attentionBadge(3)).toBe("3");
    expect(attentionBadge(12)).toBe("9+");
  });
});

describe("isActiveEvent", () => {
  it("treats undated events as active and applies the grace window", () => {
    expect(isActiveEvent(null, TODAY)).toBe(true);
    expect(isActiveEvent("2026-06-01", TODAY)).toBe(true); // within 30 days
    expect(isActiveEvent("2026-04-01", TODAY)).toBe(false); // long finished
  });
});
