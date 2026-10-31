import type { QproRow } from "./types";

/**
 * Rates as defined in the BFARS 1 QPRO sample workbook ("Calculated" columns):
 * accomplishment = actual ÷ target, utilization = disbursements ÷ allotment.
 * Totals average the physical % across rows ("TOTAL / WEIGHTED" row).
 */
export const accomplishment = (target: number, actual: number) => (target > 0 ? actual / target : 0);
export const utilization = (allotment: number, disbursements: number) => (allotment > 0 ? disbursements / allotment : 0);

export interface QproTotals {
  count: number;
  target: number;
  actual: number;
  allotment: number;
  obligations: number;
  disbursements: number;
}

export function totalsOf(rows: QproRow[]): QproTotals {
  const n = rows.length;
  const sum = (f: (r: QproRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    count: n,
    target: n ? sum((r) => r.physicalTarget) / n : 0,
    actual: n ? sum((r) => r.physicalActual) / n : 0,
    allotment: sum((r) => r.allotment),
    obligations: sum((r) => r.obligations),
    disbursements: sum((r) => r.disbursements),
  };
}

export type QproGroupKey = "allotmentClass" | "department" | "uacsMajor" | "programType" | "pap";

export interface QproGroup extends QproTotals {
  key: string;
}

export function groupBy(rows: QproRow[], key: QproGroupKey, order?: readonly string[]): QproGroup[] {
  const map = new Map<string, QproRow[]>();
  rows.forEach((r) => map.set(r[key], [...(map.get(r[key]) ?? []), r]));
  const groups = [...map.entries()].map(([k, rs]) => ({ key: k, ...totalsOf(rs) }));
  return order ? groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : groups.sort((a, b) => a.key.localeCompare(b.key));
}
