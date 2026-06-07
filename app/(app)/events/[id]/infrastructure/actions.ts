"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import {
  getRegisterByTable,
  registerFieldType,
  REGISTERS,
  REGISTER_TABLES,
  type ColType,
} from "@/lib/infra/registers";
import { parseWorkbook } from "@/lib/import/parse";
import { buildInfraTables } from "@/lib/import/infra-rows";

function assertTable(table: string) {
  if (!REGISTER_TABLES.has(table)) throw new Error("Unknown register");
}

function revalidateRegister(table: string, eventId: string) {
  const reg = getRegisterByTable(table);
  if (reg) revalidatePath(`/events/${eventId}/infrastructure/${reg.key}`);
  revalidatePath(`/events/${eventId}`);
}

function coerce(type: ColType, value: string | number | boolean | null): unknown {
  switch (type) {
    case "bool":
      return Boolean(value);
    case "num": {
      if (value === null || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case "int": {
      if (value === null || value === "") return null;
      const n = Math.trunc(Number(value));
      return Number.isFinite(n) ? n : null;
    }
    case "supplier":
      return value === null || value === "" ? null : String(value);
    default: {
      // text / select / date / time
      if (value === null) return null;
      const s = String(value).trim();
      return s === "" ? null : s;
    }
  }
}

export async function addInfraRow(input: { table: string; eventId: string }) {
  const ctx = await requireContext();
  const { table, eventId } = z
    .object({ table: z.string(), eventId: z.string().uuid() })
    .parse(input);
  assertTable(table);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from(table)
    .insert({ event_id: eventId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add row");
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: table,
    entityId: data.id,
    action: "create",
  });
  revalidateRegister(table, eventId);
  return { id: data.id as string };
}

export async function updateInfraField(input: {
  table: string;
  rowId: string;
  eventId: string;
  field: string;
  value: string | number | boolean | null;
}) {
  const ctx = await requireContext();
  const { table, rowId, eventId, field, value } = z
    .object({
      table: z.string(),
      rowId: z.string().uuid(),
      eventId: z.string().uuid(),
      field: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    })
    .parse(input);
  assertTable(table);
  const type = registerFieldType(table, field);
  if (!type) throw new Error("Unknown field");
  const coerced = coerce(type, value);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table).update({ [field]: coerced }).eq("id", rowId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: table,
    entityId: rowId,
    action: `edit:${field}`,
    after: { [field]: coerced },
  });
  revalidateRegister(table, eventId);
  return { ok: true };
}

/** Backfill the infra registers for an already-imported event from its stored workbook. */
export async function importInfraFromWorkbook(input: { eventId: string }) {
  const ctx = await requireContext();
  const { eventId } = z.object({ eventId: z.string().uuid() }).parse(input);
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("import_jobs")
    .select("storage_path")
    .eq("event_id", eventId)
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job?.storage_path) return { error: "No stored workbook for this event." };

  const { data: blob, error: dlErr } = await supabase.storage.from("imports").download(job.storage_path);
  if (dlErr || !blob) return { error: `Could not read stored workbook: ${dlErr?.message}` };

  const parsed = await parseWorkbook(Buffer.from(await blob.arrayBuffer()));
  let created = 0;
  for (const { table, rows } of buildInfraTables(eventId, parsed.infrastructure)) {
    if (!rows.length) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .is("deleted_at", null);
    if ((count ?? 0) > 0) continue; // table already populated — skip
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).insert(rows);
    if (!error) created += rows.length;
  }

  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: "infrastructure",
    entityId: eventId,
    action: "import_from_workbook",
    after: { created },
  });
  for (const reg of REGISTERS) revalidatePath(`/events/${eventId}/infrastructure/${reg.key}`);
  revalidatePath(`/events/${eventId}`);
  return { created };
}

export async function removeInfraRow(input: { table: string; rowId: string; eventId: string }) {
  const ctx = await requireContext();
  const { table, rowId, eventId } = z
    .object({ table: z.string(), rowId: z.string().uuid(), eventId: z.string().uuid() })
    .parse(input);
  assertTable(table);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, {
    orgId: ctx.orgId,
    eventId,
    actor: ctx.userId,
    entity: table,
    entityId: rowId,
    action: "archive",
  });
  revalidateRegister(table, eventId);
  return { ok: true };
}
