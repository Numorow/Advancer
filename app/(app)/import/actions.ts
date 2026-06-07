"use server";

import { requireContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseWorkbook } from "@/lib/import/parse";
import { commitWorkbook } from "@/lib/import/commit";
import type { ParseWarning } from "@/lib/import/types";

export interface PreviewResult {
  jobId: string;
  eventName: string;
  counts: Record<string, number>;
  warnings: ParseWarning[];
  samples: {
    checklist: { section: string; item: string }[];
    budget: { category: string; item: string; quotedExGstCents: number | null }[];
    schedule: { eventDate: string | null; startTime: string | null; action?: string }[];
  };
  error?: string;
}

export async function uploadAndPreview(formData: FormData): Promise<PreviewResult> {
  const ctx = await requireContext();
  if (ctx.role === "none" || !ctx.orgId) {
    return emptyPreview("You are not a member of an organisation yet.");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return emptyPreview("Please choose an .xlsx file to import.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseWorkbook(buffer);
  const supabase = await createClient();

  const { data: job, error: jobErr } = await supabase
    .from("import_jobs")
    .insert({
      org_id: ctx.orgId,
      filename: file.name,
      status: "parsed",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (jobErr || !job) return emptyPreview(`Could not create import job: ${jobErr?.message}`);

  const storagePath = `${ctx.orgId}/${job.id}/${file.name}`;
  const { error: upErr } = await supabase.storage
    .from("imports")
    .upload(storagePath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
  if (!upErr) {
    await supabase.from("import_jobs").update({ storage_path: storagePath }).eq("id", job.id);
  }

  return {
    jobId: job.id,
    eventName: parsed.eventName,
    counts: parsed.counts,
    warnings: parsed.warnings,
    samples: {
      checklist: parsed.checklist.slice(0, 6).map((c) => ({ section: c.section, item: c.item })),
      budget: parsed.budget
        .slice(0, 6)
        .map((b) => ({ category: b.category, item: b.item, quotedExGstCents: b.quotedExGstCents })),
      schedule: parsed.schedule
        .slice(0, 6)
        .map((s) => ({ eventDate: s.eventDate, startTime: s.startTime, action: s.action })),
    },
  };
}

export async function confirmImport(
  jobId: string,
): Promise<{ eventId?: string; error?: string }> {
  const ctx = await requireContext();
  if (ctx.role === "none" || !ctx.orgId) return { error: "No organisation membership." };

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select("id, storage_path, status, event_id")
    .eq("id", jobId)
    .single();
  if (!job) return { error: "Import job not found." };
  if (job.event_id) return { eventId: job.event_id };
  if (!job.storage_path) return { error: "Uploaded file is missing from storage." };

  const { data: blob, error: dlErr } = await supabase.storage
    .from("imports")
    .download(job.storage_path);
  if (dlErr || !blob) return { error: `Could not read uploaded file: ${dlErr?.message}` };

  const buffer = Buffer.from(await blob.arrayBuffer());
  const parsed = await parseWorkbook(buffer);

  try {
    const { eventId } = await commitWorkbook(supabase, {
      orgId: ctx.orgId,
      userId: ctx.userId,
      parsed,
      jobId,
    });
    return { eventId };
  } catch (e) {
    await supabase.from("import_jobs").update({ status: "failed" }).eq("id", jobId);
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
}

function emptyPreview(error: string): PreviewResult {
  return {
    jobId: "",
    eventName: "",
    counts: {},
    warnings: [],
    samples: { checklist: [], budget: [], schedule: [] },
    error,
  };
}
