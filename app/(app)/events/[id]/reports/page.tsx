import { REPORTS } from "@/lib/reports/registry";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/events/${id}/reports`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Download any report as CSV, Excel or PDF — or the full event pack.
          </p>
        </div>
        <a
          href={`${base}/event-pack?format=pdf`}
          className="inline-flex h-9 items-center rounded-md bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          Event pack (PDF)
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.key}>
            <CardHeader>
              <CardTitle>{r.title}</CardTitle>
              <CardDescription>{r.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
                <a
                  key={fmt}
                  href={`${base}/${r.key}?format=${fmt}`}
                  className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium uppercase hover:bg-[var(--muted)]"
                >
                  {fmt}
                </a>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
