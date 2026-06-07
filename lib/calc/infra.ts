/**
 * Infrastructure calculations. Fencing total metres (length + mitigation) and
 * the toilet ratio summary — the latter replaces TOILET RATIO CALC!F10's
 * #DIV/0! with a guarded null (via capacityRatio).
 */
import { capacityRatio } from "./ratio";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Fencing total run = length + mitigation (metres). */
export function fencingTotalM(lengthM: number | null, mitigationM: number | null): number {
  return round2((lengthM ?? 0) + (mitigationM ?? 0));
}

export interface ToiletLine {
  quantity: number | null;
  pans: number | null;
}

export interface ToiletAreaSummary {
  totalQuantity: number;
  totalPans: number;
  capacity: number | null;
  ratioTarget: number | null;
  /** People per pan, or null when there are no pans (guards #DIV/0!). */
  ratio: number | null;
  /** Whether the ratio meets the target (lower people-per-pan is better), or null. */
  meetsTarget: boolean | null;
}

export function toiletAreaSummary(
  lines: ToiletLine[],
  capacity: number | null,
  ratioTarget: number | null,
): ToiletAreaSummary {
  const totalPans = lines.reduce((acc, l) => acc + (l.pans ?? 0), 0);
  const totalQuantity = lines.reduce((acc, l) => acc + (l.quantity ?? 0), 0);
  const ratio = capacity != null ? capacityRatio(capacity, totalPans) : null;
  const meetsTarget = ratio != null && ratioTarget != null ? ratio <= ratioTarget : null;
  return { totalQuantity, totalPans, capacity, ratioTarget, ratio, meetsTarget };
}
