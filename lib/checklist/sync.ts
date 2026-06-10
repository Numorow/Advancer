/**
 * Shared server-side helpers that keep the checklist and budget in lock-step.
 *
 * A "line" is a `checklist_items` row (owns: name, section, supplier, the four
 * operational statuses). Its cost facet is a 1:1 `budget_items` row, linked via
 * `checklist_items.budget_item_id` and created **lazily** the first time a cost is
 * entered — so the budget mirrors the checklist without bloating it with empty rows.
 *
 * These are plain async helpers (not server actions); the "use server" action files
 * import and call them with a request-scoped Supabase client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { matchBudgetCategory, nextSort } from "@/lib/checklist/budget-sync";

type DB = SupabaseClient<Database>;

/**
 * Throw if the event's active budget version is locked (signed off). Money and
 * line-level budget changes must call this first; checklist text/status edits
 * stay allowed while locked.
 */
export async function assertBudgetUnlocked(supabase: DB, eventId: string): Promise<void> {
  const { data } = await supabase
    .from("budget_versions")
    .select("locked")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.locked) {
    throw new Error("Budget is locked — unlock it on the Estimate page to make changes.");
  }
}

/** The event's active budget version, creating a "Working budget" if none exists. */
export async function ensureActiveBudgetVersion(supabase: DB, eventId: string): Promise<string> {
  const { data: version } = await supabase
    .from("budget_versions")
    .select("id")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (version) return version.id;

  const ins = await supabase
    .from("budget_versions")
    .insert({ event_id: eventId, label: "Working budget", is_active: true })
    .select("id")
    .single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "Could not create budget version");
  return ins.data.id;
}

/** Find (or create) the budget category that mirrors a checklist section, by name. */
export async function ensureSectionCategory(
  supabase: DB,
  eventId: string,
  versionId: string,
  sectionName: string,
): Promise<string> {
  const { data: cats } = await supabase
    .from("budget_categories")
    .select("id, name, sort")
    .eq("version_id", versionId)
    .eq("event_id", eventId);

  const existing = matchBudgetCategory(cats ?? [], sectionName);
  if (existing) return existing;

  const ins = await supabase
    .from("budget_categories")
    .insert({ version_id: versionId, event_id: eventId, name: sectionName, sort: nextSort(cats ?? []) })
    .select("id")
    .single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "Could not create budget category");
  return ins.data.id;
}

/**
 * Return the budget line linked to a checklist item, creating + linking one (in the
 * section's mirror category, copying the item's name + supplier) if it doesn't exist.
 */
export async function ensureLinkedBudgetItem(
  supabase: DB,
  eventId: string,
  checklistItemId: string,
): Promise<string> {
  const { data: ci } = await supabase
    .from("checklist_items")
    .select("id, item, supplier_id, budget_item_id, section_id, checklist_sections(name)")
    .eq("id", checklistItemId)
    .single();
  if (!ci) throw new Error("Checklist item not found");
  if (ci.budget_item_id) return ci.budget_item_id;
  await assertBudgetUnlocked(supabase, eventId);

  const sectionName = (ci.checklist_sections as unknown as { name: string } | null)?.name ?? "Budget";
  const versionId = await ensureActiveBudgetVersion(supabase, eventId);
  const categoryId = await ensureSectionCategory(supabase, eventId, versionId, sectionName);

  const ins = await supabase
    .from("budget_items")
    .insert({ category_id: categoryId, event_id: eventId, item: ci.item, supplier_id: ci.supplier_id ?? null })
    .select("id")
    .single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "Could not create budget line");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("checklist_items").update({ budget_item_id: ins.data.id } as any)).eq("id", checklistItemId);
  return ins.data.id;
}

/** Soft-delete a checklist line and its linked budget/management twins. */
export async function removeLinkedLine(
  supabase: DB,
  checklistItemId: string,
): Promise<{ budgetItemId: string | null }> {
  const { data: ci } = await supabase
    .from("checklist_items")
    .select("budget_item_id, management_task_id, event_id")
    .eq("id", checklistItemId)
    .single();
  // Removing a line with a budget twin deletes that budget line too — blocked while locked.
  if (ci?.budget_item_id) await assertBudgetUnlocked(supabase, ci.event_id);
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("checklist_items").update({ deleted_at: now } as any)).eq("id", checklistItemId);
  if (error) throw new Error(error.message);
  if (ci?.budget_item_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("budget_items").update({ deleted_at: now } as any)).eq("id", ci.budget_item_id);
  }
  if (ci?.management_task_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("management_tasks").update({ deleted_at: now } as any)).eq("id", ci.management_task_id);
  }
  return { budgetItemId: ci?.budget_item_id ?? null };
}

/** Rename a line on the checklist item and its linked budget/management twins. */
export async function renameLine(supabase: DB, checklistItemId: string, name: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("checklist_items").update({ item: name } as any)).eq("id", checklistItemId);
  if (error) throw new Error(error.message);
  const { data: ci } = await supabase
    .from("checklist_items")
    .select("budget_item_id, management_task_id")
    .eq("id", checklistItemId)
    .single();
  if (ci?.budget_item_id) {
    await supabase.from("budget_items").update({ item: name }).eq("id", ci.budget_item_id);
  }
  if (ci?.management_task_id) {
    await supabase.from("management_tasks").update({ task: name }).eq("id", ci.management_task_id);
  }
}

/* --------------------------------------------- checklist ↔ management mirror */

/** Sections whose items mirror 1:1 into the Management module. */
export function isManagementSection(name: string | null | undefined): boolean {
  return /^management$/i.test((name ?? "").trim());
}

/**
 * Create + link the management task for a checklist item (eager — unlike the
 * lazy budget facet, a Management-section item IS a management task). Returns
 * the task id; idempotent when already linked.
 */
export async function ensureLinkedManagementTask(
  supabase: DB,
  eventId: string,
  checklistItemId: string,
): Promise<string> {
  const { data: ci } = await supabase
    .from("checklist_items")
    .select("id, item, management_task_id, status")
    .eq("id", checklistItemId)
    .single();
  if (!ci) throw new Error("Checklist item not found");
  if (ci.management_task_id) return ci.management_task_id;

  const ins = await supabase
    .from("management_tasks")
    .insert({ event_id: eventId, task: ci.item, completed: ci.status === "done" })
    .select("id")
    .single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "Could not create management task");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("checklist_items").update({ management_task_id: ins.data.id } as any)).eq("id", checklistItemId);
  return ins.data.id;
}

/** Two-way completion: checklist status 'done' ⇄ management completed. */
export async function syncManagementCompletion(
  supabase: DB,
  managementTaskId: string,
  completed: boolean,
): Promise<void> {
  await supabase.from("management_tasks").update({ completed }).eq("id", managementTaskId);
}
