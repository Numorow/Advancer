/**
 * Systemised RFQ numbering — pure allocation logic for "Generate RFQs from
 * budget". One RFQ number per budget area (category) that still has
 * un-numbered lines; numbers are sequential per event (RFQ-001, RFQ-002, …)
 * and collision-safe alongside manually typed rfq_no values of any shape.
 */

export const RFQ_NO_PREFIX = "RFQ-";

export interface NumberingItem {
  id: string;
  categoryId: string;
  rfqNo: string | null;
}

export interface RfqAllocation {
  categoryId: string;
  rfqNo: string;
  itemIds: string[];
}

const CANONICAL = /^RFQ-(\d+)$/i;

/**
 * Assign the next sequential RFQ numbers, one per category (in the given
 * budget-sort order) that has >=1 item without a number. The counter seeds
 * past the highest existing canonical "RFQ-NNN"; non-conforming manual values
 * ("PWR-1", "12") count as taken but never poison the seed.
 */
export function allocateRfqNumbers(opts: {
  items: NumberingItem[];
  /** rfq_no values already present on BOTH rfqs and budget_items. */
  existingNumbers: string[];
  /** Category ids in budget sort order — drives numbering stability. */
  categoryOrder: string[];
  /** Zero-pad width; numbers grow past it naturally (default 3 → RFQ-001). */
  pad?: number;
}): RfqAllocation[] {
  const { items, existingNumbers, categoryOrder, pad = 3 } = opts;

  const taken = new Set<string>();
  let counter = 0;
  const claim = (raw: string | null | undefined) => {
    const v = (raw ?? "").trim();
    if (!v) return;
    taken.add(v.toLowerCase());
    const m = CANONICAL.exec(v);
    if (m) counter = Math.max(counter, parseInt(m[1], 10));
  };
  existingNumbers.forEach(claim);
  items.forEach((i) => claim(i.rfqNo));

  const next = () => {
    let candidate: string;
    do {
      counter += 1;
      candidate = `${RFQ_NO_PREFIX}${String(counter).padStart(pad, "0")}`;
    } while (taken.has(candidate.toLowerCase()));
    taken.add(candidate.toLowerCase());
    return candidate;
  };

  const byCategory = new Map<string, string[]>();
  for (const item of items) {
    if (item.rfqNo !== null && item.rfqNo.trim() !== "") continue;
    const arr = byCategory.get(item.categoryId) ?? [];
    arr.push(item.id);
    byCategory.set(item.categoryId, arr);
  }

  const allocations: RfqAllocation[] = [];
  for (const categoryId of categoryOrder) {
    const itemIds = byCategory.get(categoryId);
    if (!itemIds || itemIds.length === 0) continue;
    allocations.push({ categoryId, rfqNo: next(), itemIds });
  }
  return allocations;
}
