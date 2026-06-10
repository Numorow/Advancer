import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NavLink } from "@/components/nav-link";
import { Badge } from "@/components/ui/badge";

const DEFERRED: string[] = [];

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireContext();
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, start_date, end_date")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!event) notFound();

  const base = `/events/${id}`;
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-56 lg:shrink-0">
        <div className="mb-3">
          <h2 className="text-sm font-semibold leading-tight">{event.name}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="info">{event.status}</Badge>
            {event.start_date && (
              <span className="text-xs text-[var(--muted-foreground)]">
                {event.start_date}
                {event.end_date ? ` → ${event.end_date}` : ""}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`${base}/site`}
          className="mb-3 flex h-10 items-center justify-center rounded-md bg-[var(--primary)] text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          📱 Site mode
        </Link>
        <nav className="space-y-0.5">
          <NavLink href={base} exact>
            Dashboard
          </NavLink>
          <NavLink href={`${base}/checklist`}>Checklist</NavLink>
          <NavLink href={`${base}/budget`}>Budget</NavLink>
          <NavLink href={`${base}/rfqs`}>RFQs</NavLink>
          <NavLink href={`${base}/schedule`}>Schedule</NavLink>
          <NavLink href={`${base}/crew`}>Crew</NavLink>
          <NavLink href={`${base}/management`}>Management Tasks</NavLink>
          <NavLink href={`${base}/infrastructure`}>Infrastructure</NavLink>
          <NavLink href={`${base}/documents`}>Documents</NavLink>
          <NavLink href={`${base}/reports`}>Reports</NavLink>
          {DEFERRED.length > 0 && (
            <>
              <div className="my-2 border-t" />
              {DEFERRED.map((label) => (
                <NavLink key={label} href="#" disabled>
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
