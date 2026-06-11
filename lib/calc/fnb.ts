/**
 * Food & Beverage rollup for the event dashboard. Pure; reads raw snake_case
 * DB rows (same idiom as lib/calc/infra.ts). Site fees / bonds are income held
 * in the F&B module — never mixed into the cost-only budget.
 */

type Row = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);

/** A vendor is outstanding if any compliance doc isn't approved yet. */
const COMPLIANCE_FIELDS = ["licence_status", "coi_status", "permit_status"] as const;
function isCompliant(v: Row): boolean {
  return COMPLIANCE_FIELDS.every((f) => v[f] === "approved");
}

export interface FnbRollup {
  vendorCount: number;
  siteFeesCents: number;
  bondsCents: number;
  /** Vendors with at least one compliance doc not approved. */
  complianceOutstanding: number;
  cateringHeadcount: number;
  cateringCostCents: number;
}

export function fnbRollup(vendors: Row[], catering: Row[]): FnbRollup {
  return {
    vendorCount: vendors.length,
    siteFeesCents: vendors.reduce((a, v) => a + num(v.site_fee_cents), 0),
    bondsCents: vendors.reduce((a, v) => a + num(v.bond_cents), 0),
    complianceOutstanding: vendors.filter((v) => !isCompliant(v)).length,
    cateringHeadcount: catering.reduce((a, c) => a + num(c.headcount), 0),
    cateringCostCents: catering.reduce((a, c) => a + num(c.cost_cents), 0),
  };
}
