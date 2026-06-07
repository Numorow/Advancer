import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    .select("id, name, status, start_date, end_date, venues(name), clients(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Every event workspace you advance from plan to live site.
          </p>
        </div>
        <Link href="/import">
          <Button>Import workbook</Button>
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No events yet. Import the Kyron event workbook to create your first
              workspace.
            </p>
            <Link href="/import">
              <Button>Import the workbook</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const venue = e.venues as unknown as { name: string } | null;
            const client = e.clients as unknown as { name: string } | null;
            return (
              <Link key={e.id} href={`/events/${e.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{e.name}</CardTitle>
                      <Badge tone={statusTone[e.status] ?? "default"}>{e.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-[var(--muted-foreground)]">
                    {client?.name && <div>{client.name}</div>}
                    {venue?.name && <div>{venue.name}</div>}
                    {e.start_date && (
                      <div>
                        {e.start_date}
                        {e.end_date ? ` → ${e.end_date}` : ""}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
