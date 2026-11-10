import type { Quarter } from "../qpro/types";
import type { SaaodbParams, SaaodbSignatory } from "../saaodb/types";
import type { ObjectClass } from "../saaodboe/types";

/** BFARS 6 uses the same filters as BFARS 2 and 3 (empty strings mean "All"). */
export type SabudbParams = SaaodbParams;

/** One UACS object code line, columns as in the BFARS 6 report mockup. */
export interface SabudbRow {
  /** UACS object code, e.g. "5010101". */
  uacsCode: string;
  objectClass: ObjectClass;
  objectOfExpenditure: string;
  /** Approved budget under the GAA (original appropriation). */
  gaaOriginal: number;
  /** Supplemental appropriations (none in the sample). */
  supplemental: number;
  allotments: number;
  obligations: number;
  disbursements: number;
}

export interface SabudbReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  asOf: string;
  agency: string;
  fundSource: string;
  rows: SabudbRow[];
  /** Same lines and filters for the same quarter of the previous fiscal year; null when that year has no data. */
  previous: { fiscalYear: number; rows: SabudbRow[] } | null;
  signatories: SaaodbSignatory[];
  options: { departments: string[]; uacsMajors: { code: string; label: string }[] };
}
