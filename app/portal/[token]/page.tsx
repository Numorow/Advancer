import type { Metadata } from "next";
import { createClient as createBareClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/* The portal is public (token = capability), so it renders per-request with a
 * session-less anon client; portal_payload() exposes exactly the read model. */
export const dynamic = "force-dynamic";

interface PortalContact {
  position: string | null;
  name: string | null;
  company: string | null;
  mobile: string | null;
  email: string | null;
}

interface PortalScheduleRow {
  date: string | null;
  start: string | null;
  finish: string | null;
  type: string | null;
  action: string | null;
  location: string | null;
  supplier?: string | null;
  sitePoc?: string | null;
  completed: boolean;
}

interface PortalRfq {
  rfqNo: string | null;
  title: string;
  status: string;
  recipientStatus: string;
  deliveryDate: string | null;
  collectionDate: string | null;
  responseDue: string | null;
  location: string | null;
  notes: string | null;
  items: { description: string; quantity: string | null; unit: string | null }[];
}

interface PortalPayload {
  kind: "client" | "supplier";
  label: string | null;
  event: { name: string; startDate: string | null; endDate: string | null };
  contacts: PortalContact[];
  // client
  progress?: { checklistTotal: number; checklistDone: number };
  scheduleProgress?: { total: number; done: number; criticalOpen: number };
  siteMaps?: { version: string | null; label: string | null; url: string | null }[];
  // supplier
  supplier?: { name: string } | null;
  rfqs?: PortalRfq[];
  schedule?: PortalScheduleRow[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const t = (v: string | null) => (v ? v.slice(0, 5) : null);

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = createBareClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase.rpc("portal_payload", { p_token: token });
  const payload = data as unknown as PortalPayload | null;

  if (!payload) {
    return (
      <Shell>
        <div className="rounded-md border bg-[var(--card)] p-8 text-center">
          <h1 className="text-lg font-semibold">This link isn&apos;t available</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            The portal link has expired or been revoked. Ask your Kyron contact for a new one.
          </p>
        </div>
      </Shell>
    );
  }

  const dates =
    payload.event.startDate &&
    `${payload.event.startDate}${payload.event.endDate ? ` → ${payload.event.endDate}` : ""}`;

  const byDay = new Map<string, PortalScheduleRow[]>();
  for (const row of payload.schedule ?? []) {
    const key = row.date ?? "";
    byDay.set(key, [...(byDay.get(key) ?? []), row]);
  }

  return (
    <Shell>
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/advancer-mark.png" alt="" className="h-6 w-6" />
          <span className="text-xs font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
            {payload.kind === "client" ? "Event portal" : "Supplier portal"}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{payload.event.name}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {payload.kind === "supplier" && payload.supplier ? `For ${payload.supplier.name} · ` : ""}
          {dates ?? "Dates to be confirmed"}
        </p>
      </header>

      {payload.kind === "client" && payload.progress && payload.scheduleProgress && (
        <section className="grid grid-cols-3 gap-3">
          <Stat
            label="Checklist"
            value={
              payload.progress.checklistTotal
                ? `${Math.round((payload.progress.checklistDone / payload.progress.checklistTotal) * 100)}%`
                : "—"
            }
            sub={`${payload.progress.checklistDone}/${payload.progress.checklistTotal} done`}
          />
          <Stat
            label="Schedule"
            value={`${payload.scheduleProgress.done}/${payload.scheduleProgress.total}`}
            sub="entries complete"
          />
          <Stat
            label="Critical open"
            value={String(payload.scheduleProgress.criticalOpen)}
            sub="critical-path items"
            tone={payload.scheduleProgress.criticalOpen > 0 ? "danger" : "success"}
          />
        </section>
      )}

      {payload.kind === "supplier" && (payload.rfqs?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Your requests for quote
          </h2>
          {payload.rfqs!.map((r, i) => (
            <div key={i} className="rounded-md border bg-[var(--card)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">
                  {r.rfqNo ? `${r.rfqNo} — ` : ""}
                  {r.title}
                </h3>
                <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-[var(--muted-foreground)]">
                  {r.recipientStatus}
                </span>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {r.responseDue && <Meta k="Quote due" v={r.responseDue} />}
                {r.deliveryDate && <Meta k="Delivery" v={r.deliveryDate} />}
                {r.collectionDate && <Meta k="Collection" v={r.collectionDate} />}
                {r.location && <Meta k="Location" v={r.location} />}
              </dl>
              {r.items.length > 0 && (
                <ul className="mt-3 space-y-1 border-t pt-2 text-sm">
                  {r.items.map((it, j) => (
                    <li key={j} className="flex justify-between gap-3">
                      <span>{it.description}</span>
                      <span className="shrink-0 text-[var(--muted-foreground)]">
                        {[it.quantity, it.unit].filter(Boolean).join(" ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {r.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">{r.notes}</p>}
            </div>
          ))}
        </section>
      )}

      {byDay.size > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {payload.kind === "supplier" ? "Your schedule" : "Master schedule"}
          </h2>
          {[...byDay.entries()].map(([day, rows]) => (
            <div key={day || "undated"} className="overflow-hidden rounded-md border">
              <div className="border-b bg-[var(--muted)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {fmtDate(day || null)}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-t first:border-t-0 ${row.completed ? "opacity-60" : ""}`}>
                      <td className="w-20 px-3 py-1.5 tabular-nums text-[var(--muted-foreground)]">
                        {t(row.start) ?? "—"}
                        {t(row.finish) ? `–${t(row.finish)}` : ""}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className={row.completed ? "line-through" : ""}>{row.action ?? "—"}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {[
                            row.type?.replace(/_/g, " ").toLowerCase(),
                            payload.kind === "client" ? row.supplier : row.sitePoc && `POC: ${row.sitePoc}`,
                            row.location,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </td>
                      <td className="w-8 px-3 py-1.5 text-right">{row.completed ? "✓" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {payload.contacts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Key contacts
          </h2>
          <div className="divide-y rounded-md border bg-[var(--card)]">
            {payload.contacts.map((c, i) => (
              <div key={i} className="px-3 py-2">
                <div className="text-sm font-medium">{c.name ?? "—"}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {[c.position, c.company].filter(Boolean).join(" · ")}
                </div>
                {(c.mobile || c.email) && (
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm">
                    {c.mobile && (
                      <a className="text-[var(--primary)]" href={`tel:${c.mobile}`}>
                        {c.mobile}
                      </a>
                    )}
                    {c.email && (
                      <a className="text-[var(--primary)]" href={`mailto:${c.email}`}>
                        {c.email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {payload.kind === "client" && (payload.siteMaps?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Site maps
          </h2>
          <ul className="space-y-1 text-sm">
            {payload.siteMaps!.map((m, i) => (
              <li key={i}>
                {m.url ? (
                  <a className="text-[var(--primary)] underline" href={m.url} target="_blank" rel="noreferrer">
                    {[m.version, m.label].filter(Boolean).join(" — ") || m.url}
                  </a>
                ) : (
                  [m.version, m.label].filter(Boolean).join(" — ")
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t pt-4 text-center text-xs text-[var(--muted-foreground)]">
        Read-only view · Advancer — A Kyron System
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-8">{children}</main>;
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-md border bg-[var(--card)] p-3">
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div
        className={
          "mt-0.5 text-xl font-semibold tabular-nums " +
          (tone === "danger" ? "text-[var(--destructive)]" : tone === "success" ? "text-[var(--success)]" : "")
        }
      >
        {value}
      </div>
      <div className="text-xs text-[var(--muted-foreground)]">{sub}</div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-[var(--muted-foreground)]">{k}:</dt>
      <dd>{v}</dd>
    </div>
  );
}
