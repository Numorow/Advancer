import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusTone: Record<string, "info" | "success" | "muted" | "default"> = {
  planning: "info",
  active: "success",
  delivered: "default",
  archived: "muted",
};

export default async function EventsHome() {
  await requireContext();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, start_date, end_date, image_path, venues(name), clients(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Batched signed URLs for event cover images (private bucket).
  const signed = new Map<string, string>();
  const imgPaths = (events ?? []).map((e) => e.image_path).filter((p): p is string => Boolean(p));
  if (imgPaths.length) {
    const { data: urls } = await supabase.storage.from("event-images").createSignedUrls(imgPaths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Every event workspace you advance from plan to live site.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link href="/events/new">
            <Button>Create new event</Button>
          </Link>
          <Link href="/import" className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline">
            or import a workbook
          </Link>
        </div>
      </div>

      {!events || events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="space-y-1">
              <p className="text-base font-medium">Create your first event</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Starts as a blank copy of the Kyron workbook — sections, budget
                categories and toilet calculator ready to fill.
              </p>
            </div>
            <Link href="/events/new">
              <Button size="lg">Create your first event</Button>
            </Link>
            <Link href="/import" className="text-sm text-[var(--muted-foreground)] hover:underline">
              or import an existing workbook
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const venue = e.venues as unknown as { name: string } | null;
            const client = e.clients as unknown as { name: string } | null;
            const imageUrl = e.image_path ? signed.get(e.image_path) ?? null : null;
            return (
              <Card
                key={e.id}
                className="group flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link href={`/events/${e.id}`} className="block">
                  {imageUrl && (
                    <div className="h-32 w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt={e.name}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{e.name}</CardTitle>
                      <Badge tone={statusTone[e.status] ?? "default"}>{e.status}</Badge>
                    </div>
                  </CardHeader>
                </Link>
                <CardContent className="flex-1 space-y-1 text-sm text-[var(--muted-foreground)]">
                  {client?.name && <div>{client.name}</div>}
                  {venue?.name && <div>{venue.name}</div>}
                  {e.start_date && (
                    <div>
                      {e.start_date}
                      {e.end_date ? ` → ${e.end_date}` : ""}
                    </div>
                  )}
                  <Link
                    href={`/events/${e.id}#event-dates`}
                    className="inline-block pt-1 text-xs text-[var(--primary)] hover:underline"
                  >
                    Edit dates →
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
