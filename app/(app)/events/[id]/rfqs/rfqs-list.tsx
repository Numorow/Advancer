"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/calc/money";
import { statusMeta } from "@/lib/status";
import { createRfq, generateRfqsFromBudget } from "./actions";

export interface RfqListRow {
  id: string;
  rfqNo: string | null;
  title: string;
  status: string;
  deliveryDate: string | null;
  collectionDate: string | null;
  recipients: number;
  bestCents: number | null;
}

export function RfqsList({ eventId, rows }: { eventId: string; rows: RfqListRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    setMessage(null);
    startTransition(async () => {
      const { created } = await generateRfqsFromBudget({ eventId });
      setMessage(
        created > 0
          ? `Created ${created} RFQ${created === 1 ? "" : "s"} from budget RFQ numbers.`
          : "No new RFQs — every budget RFQ number already has one.",
      );
      router.refresh();
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    startTransition(async () => {
      const { rfqId } = await createRfq({ eventId, title: t });
      router.push(`/events/${eventId}/rfqs/${rfqId}`);
    });
  }

  const visible = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={pending}>
            Generate RFQs from budget
          </Button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border bg-[var(--card)] px-2 text-sm"
          >
            <option value="">All statuses</option>
            {["draft", "sent", "responded", "awarded", "declined", "cancelled"].map((s) => (
              <option key={s} value={s}>
                {statusMeta("rfq_workflow", s).label}
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={onCreate} className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New RFQ title"
            className="h-9 w-56 rounded-md border bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <Button type="submit" size="sm" disabled={pending}>
            Create RFQ
          </Button>
        </form>
      </div>

      {message && <p className="text-sm text-[var(--muted-foreground)]">{message}</p>}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead className="bg-[var(--muted)]/60 text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <Th>RFQ #</Th>
              <Th className="w-[34%]">Title</Th>
              <Th>Status</Th>
              <Th className="text-center">Recipients</Th>
              <Th className="text-right">Best quote</Th>
              <Th>Delivery</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const meta = statusMeta("rfq_workflow", r.status);
              return (
                <tr key={r.id} className="border-t hover:bg-[var(--muted)]/40">
                  <td className="px-3 py-2 font-mono text-xs">{r.rfqNo ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/events/${eventId}/rfqs/${r.id}`} className="hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-center">{r.recipients}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.bestCents != null ? formatCents(r.bestCents) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{r.deliveryDate ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/events/${eventId}/rfqs/${r.id}`} className="text-xs text-[var(--primary)] hover:underline">
                      open →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[var(--muted-foreground)]">
                  No RFQs yet. Generate them from the budget, or create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
