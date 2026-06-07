import type { NextRequest } from "next/server";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getReport, REPORTS } from "@/lib/reports/registry";
import { toCsv } from "@/lib/reports/csv";
import { toXlsx } from "@/lib/reports/xlsx";
import { toPdf, toEventPackPdf } from "@/lib/reports/pdf";
import type { ExportFormat } from "@/lib/reports/types";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

function fileResponse(body: Buffer | string, filename: string, contentType: string): Response {
  return new Response(body as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; report: string }> },
) {
  await requireContext();
  const { id, report: reportKey } = await params;
  const format = (req.nextUrl.searchParams.get("format") ?? "csv") as ExportFormat;

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!event) return new Response("Event not found", { status: 404 });
  const eventName = event.name;
  const prefix = slug(eventName);

  // Full event pack (multi-section PDF).
  if (reportKey === "event-pack") {
    const datas = [];
    for (const def of REPORTS) {
      try {
        datas.push(await def.build(supabase, id));
      } catch {
        /* skip a failing section */
      }
    }
    const buf = await toEventPackPdf(datas, eventName);
    return fileResponse(buf, `${prefix}-event-pack.pdf`, "application/pdf");
  }

  const def = getReport(reportKey);
  if (!def) return new Response("Unknown report", { status: 404 });
  const data = await def.build(supabase, id);
  const base = `${prefix}-${reportKey}`;

  if (format === "csv") {
    return fileResponse(Buffer.from(toCsv(data), "utf8"), `${base}.csv`, "text/csv; charset=utf-8");
  }
  if (format === "xlsx") {
    return fileResponse(
      await toXlsx(data),
      `${base}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }
  return fileResponse(await toPdf(data, eventName), `${base}.pdf`, "application/pdf");
}
