"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAndPreview, confirmImport, type PreviewResult } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/calc/money";

export default function ImportPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, startParse] = useTransition();
  const [committing, startCommit] = useTransition();

  function onUpload(formData: FormData) {
    setError(null);
    startParse(async () => {
      const result = await uploadAndPreview(formData);
      if (result.error) setError(result.error);
      else setPreview(result);
    });
  }

  function onConfirm() {
    if (!preview) return;
    setError(null);
    startCommit(async () => {
      const result = await confirmImport(preview.jobId);
      if (result.error) setError(result.error);
      else if (result.eventId) {
        router.push(`/events/${result.eventId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Import workbook</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Upload the Kyron event workbook (.xlsx). Advancer extracts the
          checklist, budget and master schedule into a new event workspace.
        </p>
      </div>

      {!preview && (
        <Card>
          <CardHeader>
            <CardTitle>1. Upload</CardTitle>
            <CardDescription>
              We parse the workbook and show you a preview before anything is
              committed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={onUpload} className="flex items-center gap-3">
              <input
                type="file"
                name="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--primary-foreground)]"
              />
              <Button type="submit" disabled={parsing}>
                {parsing ? "Parsing…" : "Parse"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-[var(--destructive)]">{error}</CardContent>
        </Card>
      )}

      {preview && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>2. Preview — {preview.eventName}</CardTitle>
                <Badge tone="info">ready to import</Badge>
              </div>
              <CardDescription>
                Review the extracted counts and any spreadsheet errors, then
                confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ["Checklist", preview.counts.checklist],
                    ["Budget", preview.counts.budget],
                    ["Schedule", preview.counts.schedule],
                    ["Crew", preview.counts.crew],
                    ["Contacts", preview.counts.contacts],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label} className="rounded-md border p-3">
                    <div className="text-2xl font-semibold">{n ?? 0}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
                  </div>
                ))}
              </div>

              <SampleTable
                title="Checklist (first rows)"
                head={["Section", "Item"]}
                rows={preview.samples.checklist.map((c) => [c.section, c.item])}
              />
              <SampleTable
                title="Budget (first rows)"
                head={["Category", "Item", "Quoted ex-GST"]}
                rows={preview.samples.budget.map((b) => [
                  b.category,
                  b.item,
                  b.quotedExGstCents == null ? "—" : formatCents(b.quotedExGstCents),
                ])}
              />
              <SampleTable
                title="Master schedule (first rows)"
                head={["Date", "Start", "Action"]}
                rows={preview.samples.schedule.map((s) => [
                  s.eventDate ?? "—",
                  s.startTime ?? "—",
                  s.action ?? "—",
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Spreadsheet warnings ({preview.warnings.length})
              </CardTitle>
              <CardDescription>
                Formula errors in the source workbook. These are flagged, never
                imported as values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {preview.warnings.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No warnings.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {preview.warnings.map((w, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Badge tone="warning">{w.kind.replace("_", " ")}</Badge>
                      <span className="font-mono text-xs">
                        {w.sheet}!{w.cell}
                      </span>
                      <span className="text-[var(--muted-foreground)]">{w.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={onConfirm} disabled={committing}>
              {committing ? "Importing…" : "Confirm import"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPreview(null)}
              disabled={committing}
            >
              Choose another file
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SampleTable({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{title}</div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
