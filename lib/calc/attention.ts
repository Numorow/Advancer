/**
 * "Needs attention" feed — derived live from current data (no notifications
 * table, no cron): items appear while the underlying problem exists and clear
 * themselves the moment it's fixed. Severity drives ordering: danger first.
 */

export type AttentionSeverity = "danger" | "warning" | "info";

export interface AttentionItem {
  severity: AttentionSeverity;
  kind:
    | "critical-open"
    | "checklist-overdue"
    | "rfq-overdue"
    | "schedule-today"
    | "booked-unpaid"
    | "management-overdue";
  label: string;
  detail?: string;
  href: string;
}

export interface AttentionChecklistRow {
  item: string;
  dueDate: string | null;
  status: string;
  bookingStatus: string;
  paymentStatus: string;
}

export interface AttentionRfqRow {
  title: string;
  rfqNo: string | null;
  status: string;
  responseDueDate: string | null;
  recipients: { status: string }[];
}

export interface AttentionScheduleRow {
  action: string | null;
  eventDate: string | null;
  completed: boolean;
  criticalPath: boolean;
}

export interface AttentionManagementRow {
  task: string | null;
  weekDate: string | null;
  completed: boolean;
}

export interface AttentionInputs {
  checklist: AttentionChecklistRow[];
  rfqs: AttentionRfqRow[];
  schedule: AttentionScheduleRow[];
  management: AttentionManagementRow[];
}

const SEVERITY_ORDER: Record<AttentionSeverity, number> = { danger: 0, warning: 1, info: 2 };

/** RFQ statuses that no longer need a response chased. */
const RFQ_SETTLED = new Set(["awarded", "declined", "cancelled"]);

export function attentionForEvent(
  eventId: string,
  inputs: AttentionInputs,
  todayISO: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const base = `/events/${eventId}`;

  for (const s of inputs.schedule) {
    if (!s.completed && s.criticalPath && s.eventDate && s.eventDate <= todayISO) {
      items.push({
        severity: "danger",
        kind: "critical-open",
        label: s.action ?? "Critical schedule entry",
        detail: s.eventDate < todayISO ? `critical · was due ${s.eventDate}` : "critical · today",
        href: `${base}/schedule`,
      });
    } else if (!s.completed && !s.criticalPath && s.eventDate === todayISO) {
      items.push({
        severity: "info",
        kind: "schedule-today",
        label: s.action ?? "Schedule entry",
        detail: "scheduled today",
        href: `${base}/schedule`,
      });
    }
  }

  for (const c of inputs.checklist) {
    if (c.dueDate && c.dueDate < todayISO && c.status !== "done") {
      items.push({
        severity: "warning",
        kind: "checklist-overdue",
        label: c.item,
        detail: `due ${c.dueDate}`,
        href: `${base}/checklist`,
      });
    }
    if (c.bookingStatus === "booked" && c.paymentStatus === "unpaid") {
      items.push({
        severity: "info",
        kind: "booked-unpaid",
        label: c.item,
        detail: "booked but unpaid",
        href: `${base}/budget`,
      });
    }
  }

  for (const r of inputs.rfqs) {
    const awaiting = r.recipients.some((x) => x.status === "pending" || x.status === "sent");
    if (
      r.responseDueDate &&
      r.responseDueDate < todayISO &&
      awaiting &&
      !RFQ_SETTLED.has(r.status)
    ) {
      items.push({
        severity: "warning",
        kind: "rfq-overdue",
        label: r.rfqNo ? `${r.rfqNo} — ${r.title}` : r.title,
        detail: `quotes were due ${r.responseDueDate}`,
        href: `${base}/rfqs`,
      });
    }
  }

  for (const m of inputs.management) {
    if (m.weekDate && m.weekDate < todayISO && !m.completed) {
      items.push({
        severity: "warning",
        kind: "management-overdue",
        label: m.task ?? "Management task",
        detail: `week of ${m.weekDate}`,
        href: `${base}/management`,
      });
    }
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Header-badge text: exact up to 9, then "9+". */
export function attentionBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/** An event is "active" for the attention feed until ~a month after it ends. */
export function isActiveEvent(endDate: string | null, todayISO: string, graceDays = 30): boolean {
  if (!endDate) return true;
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return true;
  const cutoff = new Date(end.getTime() + graceDays * 86_400_000);
  return cutoff.toISOString().slice(0, 10) >= todayISO;
}
