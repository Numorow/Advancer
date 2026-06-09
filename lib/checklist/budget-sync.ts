/**
 * Checklist → budget sync.
 *
 * Adding a checklist item mirrors it into the budget as a linked line item. The
 * budget category mirrors the checklist *section* name: we reuse an existing
 * category whose name matches the section (case-insensitive, whitespace-normalised),
 * otherwise the caller creates one. Rename and delete on the checklist flow through
 * to the linked budget item via `checklist_items.budget_item_id`.
 */

export interface CategoryLike {
  id: string;
  name: string;
}

/** Lowercase, trim, and collapse internal whitespace so "Site  Furniture" === "site furniture". */
export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Id of the existing budget category that mirrors `sectionName`, or null if none exists yet. */
export function matchBudgetCategory(
  categories: CategoryLike[],
  sectionName: string,
): string | null {
  const target = normalizeCategoryName(sectionName);
  const hit = categories.find((c) => normalizeCategoryName(c.name) === target);
  return hit ? hit.id : null;
}

/** Next sort index = one past the current max (so new rows land at the end of their group). */
export function nextSort(rows: { sort?: number | null }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sort ?? 0), -1) + 1;
}
