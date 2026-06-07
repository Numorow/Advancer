/**
 * Commit a parsed workbook into a new event workspace. Runs as the
 * authenticated user (RLS-enforced) inside a server action. Creates the event,
 * suppliers, checklist sections/items, budget version/categories/items,
 * schedule entries, contacts, site maps, records import_job_rows for warnings,
 * updates the import job, and writes an audit entry.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { ParsedWorkbook, ParseWarning } from "./types";
import { buildInfraTables, buildManagementRows } from "./infra-rows";

type DB = SupabaseClient<Database>;

export interface ImportReport {
  eventName: string;
  counts: Record<string, number>;
  warnings: ParseWarning[];
}

export interface CommitResult {
  eventId: string;
  report: ImportReport;
}

function uniqueNames(lists: (string | undefined)[][]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list) {
      const name = raw?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.values()];
}

async function insertChunked<T>(
  supabase: DB,
  table: string,
  rows: T[],
  chunk = 400,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).insert(slice);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function commitWorkbook(
  supabase: DB,
  opts: { orgId: string; userId: string; parsed: ParsedWorkbook; jobId: string },
): Promise<CommitResult> {
  const { orgId, userId, parsed, jobId } = opts;

  const dates = parsed.schedule
    .map((s) => s.eventDate)
    .filter((d): d is string => Boolean(d));
  const startDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const endDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  // 1. Event
  const { data: event, error: evErr } = await supabase
    .from("events")
    .insert({
      org_id: orgId,
      name: parsed.eventName,
      status: "planning",
      start_date: startDate,
      end_date: endDate,
      created_by: userId,
    })
    .select("id")
    .single();
  if (evErr || !event) throw new Error(`event: ${evErr?.message ?? "insert failed"}`);
  const eventId = event.id;

  // 2. Suppliers (distinct names across modules)
  const supplierNames = uniqueNames([
    parsed.budget.map((b) => b.supplier),
    parsed.checklist.map((c) => c.supplier),
    parsed.schedule.map((s) => s.supplier),
  ]);
  const supplierMap = new Map<string, string>();
  if (supplierNames.length) {
    const { data: sups, error } = await supabase
      .from("suppliers")
      .insert(supplierNames.map((name) => ({ org_id: orgId, name })))
      .select("id, name");
    if (error) throw new Error(`suppliers: ${error.message}`);
    for (const s of sups ?? []) supplierMap.set(s.name.toLowerCase(), s.id);
  }
  const supId = (n?: string) => (n ? (supplierMap.get(n.toLowerCase()) ?? null) : null);

  // 3. Checklist sections + items
  const sectionNames = [...new Set(parsed.checklist.map((c) => c.section))];
  const sectionMap = new Map<string, string>();
  if (sectionNames.length) {
    const { data: secs, error } = await supabase
      .from("checklist_sections")
      .insert(sectionNames.map((name, idx) => ({ event_id: eventId, name, sort: idx })))
      .select("id, name");
    if (error) throw new Error(`checklist_sections: ${error.message}`);
    for (const s of secs ?? []) sectionMap.set(s.name, s.id);
  }
  if (parsed.checklist.length) {
    await insertChunked(
      supabase,
      "checklist_items",
      parsed.checklist.map((c, idx) => ({
        section_id: sectionMap.get(c.section)!,
        event_id: eventId,
        item: c.item,
        details: c.details ?? null,
        supplier_id: supId(c.supplier),
        responsible: c.responsible ?? null,
        rfq_status: c.rfqSent ? "sent" : "not_sent",
        booking_status: c.booked ? "booked" : "not_booked",
        payment_status: c.paid ? "paid" : "unpaid",
        status: c.paid ? "done" : c.booked ? "in_progress" : "not_started",
        sort: idx,
      })),
    );
  }

  // 4. Budget version + categories + items
  const { data: version, error: verErr } = await supabase
    .from("budget_versions")
    .insert({ event_id: eventId, label: "Imported from workbook", is_active: true })
    .select("id")
    .single();
  if (verErr || !version) throw new Error(`budget_versions: ${verErr?.message}`);
  const versionId = version.id;

  const catNames = [...new Set(parsed.budget.map((b) => b.category))];
  const catMap = new Map<string, string>();
  if (catNames.length) {
    const { data: cats, error } = await supabase
      .from("budget_categories")
      .insert(
        catNames.map((name, idx) => ({
          version_id: versionId,
          event_id: eventId,
          name,
          sort: idx,
        })),
      )
      .select("id, name");
    if (error) throw new Error(`budget_categories: ${error.message}`);
    for (const c of cats ?? []) catMap.set(c.name, c.id);
  }
  if (parsed.budget.length) {
    await insertChunked(
      supabase,
      "budget_items",
      parsed.budget.map((b, idx) => ({
        category_id: catMap.get(b.category)!,
        event_id: eventId,
        item: b.item,
        supplier_id: supId(b.supplier),
        insurance: b.insurance ?? null,
        quoted_ex_gst_cents: b.quotedExGstCents ?? 0,
        actual_inc_gst_cents: b.actualIncGstCents ?? 0,
        quote_link: b.quoteLink ?? null,
        approval_status: b.approved ? "approved" : "pending",
        payment_status: b.paid ? "paid" : "unpaid",
        rfq_no: b.rfqNo ?? null,
        notes: b.notes ?? null,
        sort: idx,
      })),
    );
  }

  // 5. Schedule entries
  if (parsed.schedule.length) {
    await insertChunked(
      supabase,
      "schedule_entries",
      parsed.schedule.map((s, idx) => ({
        event_id: eventId,
        event_date: s.eventDate,
        start_time: s.startTime,
        finish_time: s.finishTime,
        type: s.type,
        supplier_id: supId(s.supplier),
        supplier_text: s.supplier ?? null,
        action: s.action ?? null,
        location: s.location ?? null,
        site_poc: s.sitePoc ?? null,
        notes: s.notes ?? null,
        completed: s.completed,
        sort: idx,
      })),
    );
  }

  // 5b. Crew shifts
  if (parsed.crew.length) {
    await insertChunked(
      supabase,
      "crew_shifts",
      parsed.crew.map((s, idx) => ({
        event_id: eventId,
        shift_date: s.shiftDate,
        day_label: s.dayLabel ?? null,
        role_name: s.role ?? null,
        start_time: s.startTime,
        finish_time: s.finishTime,
        scheduled_hours: s.scheduledHours,
        actual_hours: s.actualHours,
        rate_cents: s.rateCents,
        sort: idx,
      })),
    );
  }

  // 5c. Infrastructure registers + 5d. Management tasks (shared row builders)
  for (const { table, rows } of buildInfraTables(eventId, parsed.infrastructure)) {
    if (rows.length) await insertChunked(supabase, table, rows);
  }
  const mgmtRows = buildManagementRows(eventId, parsed.management);
  if (mgmtRows.length) await insertChunked(supabase, "management_tasks", mgmtRows);

  // 6. Contacts, billing, site maps
  if (parsed.contacts.length) {
    await supabase.from("event_contacts").insert(
      parsed.contacts.map((c, idx) => ({
        event_id: eventId,
        position: c.position ?? null,
        name: c.name ?? null,
        company: c.company ?? null,
        mobile: c.mobile ?? null,
        email: c.email ?? null,
        sort: idx,
      })),
    );
  }
  await supabase
    .from("event_billing_profiles")
    .insert({ event_id: eventId, responsible: "Kyron Pty Ltd" });
  if (parsed.siteMaps.length) {
    await supabase.from("event_site_maps").insert(
      parsed.siteMaps.map((m) => ({
        event_id: eventId,
        label: m.label ?? null,
        url: m.url ?? null,
      })),
    );
  }

  // 7. Warnings -> import_job_rows
  if (parsed.warnings.length) {
    await insertChunked(
      supabase,
      "import_job_rows",
      parsed.warnings.map((w) => ({
        job_id: jobId,
        sheet: w.sheet,
        row_ref: w.cell,
        mapped_table: null,
        raw: null,
        warnings: w as unknown as Database["public"]["Tables"]["import_job_rows"]["Insert"]["warnings"],
      })),
    );
  }

  const report: ImportReport = {
    eventName: parsed.eventName,
    counts: parsed.counts,
    warnings: parsed.warnings,
  };

  // 8. Finalise job
  await supabase
    .from("import_jobs")
    .update({
      event_id: eventId,
      status: "committed",
      report: report as unknown as Database["public"]["Tables"]["import_jobs"]["Update"]["report"],
    })
    .eq("id", jobId);

  // 9. Audit
  await supabase.from("audit_log").insert({
    org_id: orgId,
    event_id: eventId,
    actor: userId,
    entity: "event",
    entity_id: eventId,
    action: "import_committed",
    after: report as unknown as Database["public"]["Tables"]["audit_log"]["Insert"]["after"],
  });

  return { eventId, report };
}
