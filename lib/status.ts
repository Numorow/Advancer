type Tone = "default" | "muted" | "success" | "warning" | "danger" | "info";

export type StatusField =
  | "rfq_status"
  | "booking_status"
  | "payment_status"
  | "status"
  | "approval_status"
  | "compliance_status"
  | "invoice_status"
  | "quote_status"
  | "rfq_workflow"
  | "rfq_recipient";

interface Meta {
  label: string;
  tone: Tone;
}

const META: Record<StatusField, Record<string, Meta>> = {
  rfq_status: {
    not_sent: { label: "Not sent", tone: "muted" },
    sent: { label: "Sent", tone: "info" },
    responded: { label: "Responded", tone: "success" },
    declined: { label: "Declined", tone: "danger" },
  },
  booking_status: {
    not_booked: { label: "Not booked", tone: "muted" },
    tentative: { label: "Tentative", tone: "warning" },
    booked: { label: "Booked", tone: "success" },
    cancelled: { label: "Cancelled", tone: "danger" },
  },
  payment_status: {
    unpaid: { label: "Unpaid", tone: "muted" },
    partial: { label: "Partial", tone: "warning" },
    paid: { label: "Paid", tone: "success" },
  },
  status: {
    not_started: { label: "Not started", tone: "muted" },
    in_progress: { label: "In progress", tone: "info" },
    blocked: { label: "Blocked", tone: "danger" },
    done: { label: "Done", tone: "success" },
  },
  approval_status: {
    pending: { label: "Pending", tone: "muted" },
    approved: { label: "Approved", tone: "success" },
    rejected: { label: "Rejected", tone: "danger" },
  },
  compliance_status: {
    missing: { label: "Missing", tone: "muted" },
    received: { label: "Received", tone: "warning" },
    approved: { label: "Approved", tone: "success" },
  },
  invoice_status: {
    received: { label: "Received", tone: "muted" },
    approved: { label: "Approved", tone: "info" },
    paid: { label: "Paid", tone: "success" },
  },
  quote_status: {
    received: { label: "Received", tone: "muted" },
    accepted: { label: "Accepted", tone: "success" },
    rejected: { label: "Rejected", tone: "danger" },
  },
  rfq_workflow: {
    draft: { label: "Draft", tone: "muted" },
    sent: { label: "Sent", tone: "info" },
    responded: { label: "Responded", tone: "warning" },
    awarded: { label: "Awarded", tone: "success" },
    declined: { label: "Declined", tone: "danger" },
    cancelled: { label: "Cancelled", tone: "muted" },
  },
  rfq_recipient: {
    pending: { label: "Pending", tone: "muted" },
    sent: { label: "Sent", tone: "info" },
    responded: { label: "Responded", tone: "success" },
    declined: { label: "Declined", tone: "danger" },
  },
};

export const STATUS_ORDER: Record<StatusField, string[]> = {
  rfq_status: ["not_sent", "sent", "responded", "declined"],
  booking_status: ["not_booked", "tentative", "booked", "cancelled"],
  payment_status: ["unpaid", "partial", "paid"],
  status: ["not_started", "in_progress", "blocked", "done"],
  approval_status: ["pending", "approved", "rejected"],
  compliance_status: ["missing", "received", "approved"],
  invoice_status: ["received", "approved", "paid"],
  quote_status: ["received", "accepted", "rejected"],
  rfq_workflow: ["draft", "sent", "responded", "awarded", "declined", "cancelled"],
  rfq_recipient: ["pending", "sent", "responded", "declined"],
};

export function statusMeta(field: StatusField, value: string): Meta {
  return META[field][value] ?? { label: value, tone: "default" };
}

export function nextStatus(field: StatusField, value: string): string {
  const order = STATUS_ORDER[field];
  const idx = order.indexOf(value);
  return order[(idx + 1) % order.length];
}
