/**
 * Event dashboard rollups — drives the dashboard widgets from the brief
 * (budget estimated/quoted/actual/variance, checklist completion, outstanding
 * RFQ / unbooked / unpaid-booked, schedule items due today).
 */
import { rollupBudget, type BudgetLine, type BudgetRollup } from "./budget";

export interface ChecklistLite {
  status: "not_started" | "in_progress" | "blocked" | "done";
  rfqStatus: "not_sent" | "sent" | "responded" | "declined";
  bookingStatus: "not_booked" | "tentative" | "booked" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
}

export interface ScheduleLite {
  eventDate: string | null;
  completed: boolean;
}

export function checklistProgress(items: ChecklistLite[]) {
  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function outstandingCounts(items: ChecklistLite[]) {
  return {
    rfqOutstanding: items.filter((i) => i.rfqStatus === "not_sent").length,
    unbooked: items.filter((i) => i.bookingStatus === "not_booked").length,
    unpaidBooked: items.filter(
      (i) => i.bookingStatus === "booked" && i.paymentStatus !== "paid",
    ).length,
  };
}

export function scheduleSummary(entries: ScheduleLite[], todayISO: string) {
  return {
    total: entries.length,
    completed: entries.filter((e) => e.completed).length,
    dueToday: entries.filter((e) => e.eventDate === todayISO && !e.completed)
      .length,
  };
}

export interface EventDashboard {
  budget: BudgetRollup;
  checklist: ReturnType<typeof checklistProgress> &
    ReturnType<typeof outstandingCounts>;
  schedule: ReturnType<typeof scheduleSummary>;
}

export function eventDashboard(
  budget: BudgetLine[],
  checklist: ChecklistLite[],
  schedule: ScheduleLite[],
  todayISO: string,
): EventDashboard {
  return {
    budget: rollupBudget(budget),
    checklist: { ...checklistProgress(checklist), ...outstandingCounts(checklist) },
    schedule: scheduleSummary(schedule, todayISO),
  };
}
