import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { Quarter } from "../qpro/types";
import type { SaaodbParams, SaaodbSignatory } from "../saaodb/types";
import type { SabudbRow } from "../sabudb/types";

/** BFARS 7 uses the same filters as BFARS 2, 3 and 6 (empty strings mean "All"). */
export type SabudboeParams = SaaodbParams;

/**
 * One UACS object code line for one department/office and allotment class. The report and the
 * dashboard roll these up by object class, object code, MFO/PAP, office or allotment class.
 */
export interface SabudboeRow extends SabudbRow {
  office: string;
  allotmentClass: AllotmentClassCode;
  /** MFO/PAP the office's budget is charged to, e.g. "PAP-002 – Instructional Services". */
  mfoPap: string;
}

export interface SabudboeReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  asOf: string;
  agency: string;
  fundSource: string;
  rows: SabudboeRow[];
  /** Same filters for the same quarter of the previous fiscal year; null when that year has no data. */
  previous: { fiscalYear: number; rows: SabudboeRow[] } | null;
  signatories: SaaodbSignatory[];
  options: { departments: string[]; uacsMajors: { code: string; label: string }[] };
}
