/**
 * Org-wide "needs attention" fetcher — shared by the header bell and the
 * /attention page. Wrapped in React cache() so a request renders it once.
 * Scopes to active events (no end date, or ended within the last month).
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  attentionForEvent,
  isActiveEvent,
  type AttentionItem,
} from "@/lib/calc/attention";

export interface EventAttention {
  eventId: string;
  eventName: string;
  items: AttentionItem[];
}

export interface OrgAttention {
  events: EventAttention[];
  total: number;
}

export const getOrgAttention = cache(async (): Promise<OrgAttention> => {
  const supabase = await createClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  const { data: events } = await supabase
    .from("events")
    .select("id, name, end_date")
    .is("deleted_at", null)
    .order("start_date", { ascending: true, nullsFirst: false });
  const active = (events ?? []).filter((e) => isActiveEvent(e.end_date, todayISO));
  if (active.length === 0) return { events: [], total: 0 };
  const ids = active.map((e) => e.id);

  const [{ data: checklist }, { data: rfqs }, { data: schedule }, { data: management }] =
    await Promise.all([
      supabase
        .from("checklist_items")
        .select("event_id, item, due_date, status, booking_status, payment_status")
        .in("event_id", ids)
        .is("deleted_at", null),
      supabase
        .from("rfqs")
        .select("event_id, title, rfq_no, status, response_due_date, rfq_recipients(status)")
        .in("event_id", ids)
        .is("deleted_at", null),
      supabase
        .from("schedule_entries")
        .select("event_id, action, event_date, completed, critical_path")
        .in("event_id", ids)
        .is("deleted_at", null),
      supabase
        .from("management_tasks")
        .select("event_id, task, week_date, completed")
        .in("event_id", ids)
        .is("deleted_at", null),
    ]);

  const byEvent: EventAttention[] = active.map((ev) => {
    const items = attentionForEvent(
      ev.id,
      {
        checklist: (checklist ?? [])
          .filter((r) => r.event_id === ev.id)
          .map((r) => ({
            item: r.item,
            dueDate: r.due_date,
            status: r.status,
            bookingStatus: r.booking_status,
            paymentStatus: r.payment_status,
          })),
        rfqs: (rfqs ?? [])
          .filter((r) => r.event_id === ev.id)
          .map((r) => ({
            title: r.title,
            rfqNo: r.rfq_no,
            status: r.status,
            responseDueDate: r.response_due_date,
            recipients: ((r.rfq_recipients as unknown as { status: string }[]) ?? []).map((x) => ({
              status: x.status,
            })),
          })),
        schedule: (schedule ?? [])
          .filter((r) => r.event_id === ev.id)
          .map((r) => ({
            action: r.action,
            eventDate: r.event_date,
            completed: r.completed,
            criticalPath: r.critical_path,
          })),
        management: (management ?? [])
          .filter((r) => r.event_id === ev.id)
          .map((r) => ({ task: r.task, weekDate: r.week_date, completed: r.completed })),
      },
      todayISO,
    );
    return { eventId: ev.id, eventName: ev.name, items };
  });

  const withItems = byEvent.filter((e) => e.items.length > 0);
  return { events: withItems, total: withItems.reduce((a, e) => a + e.items.length, 0) };
});
