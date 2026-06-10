import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getOrgAttention } from "@/lib/attention/server";
import type { AttentionSeverity } from "@/lib/calc/attention";

const TONE: Record<AttentionSeverity, "danger" | "warning" | "info"> = {
  danger: "danger",
  warning: "warning",
  info: "info",
};

const KIND_LABEL: Record<string, string> = {
  "critical-open": "Critical path",
  "checklist-overdue": "Checklist overdue",
  "rfq-overdue": "RFQ overdue",
  "schedule-today": "Today",
  "booked-unpaid": "Unpaid",
  "management-overdue": "Mgmt overdue",
};

export default async function AttentionPage() {
  const attention = await getOrgAttention();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Needs attention</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Derived live from your active events — items clear themselves the moment the underlying
          task is resolved.
        </p>
      </div>

      {attention.events.length === 0 && (
        <div className="rounded-md border bg-[var(--card)] p-10 text-center">
          <div className="text-3xl">✓</div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Nothing needs attention right now.
          </p>
        </div>
      )}

      {attention.events.map((ev) => (
        <section key={ev.eventId} className="overflow-hidden rounded-md border">
          <div className="flex items-center justify-between border-b bg-[var(--muted)] px-3 py-2">
            <Link
              href={`/events/${ev.eventId}`}
              className="text-sm font-semibold hover:underline"
            >
              {ev.eventName}
            </Link>
            <span className="text-xs text-[var(--muted-foreground)]">
              {ev.items.length} item{ev.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y">
            {ev.items.map((item, i) => (
              <li key={i}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--muted)]/40"
                >
                  <Badge tone={TONE[item.severity]}>{KIND_LABEL[item.kind] ?? item.kind}</Badge>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.detail && (
                    <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                      {item.detail}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
