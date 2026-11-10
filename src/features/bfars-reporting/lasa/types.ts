import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { Quarter } from "../qpro/types";
import type { SaaodbSignatory } from "../saaodb/types";

export const LASA_STATUSES = ["Released", "Partial", "On Hold", "Cancelled"] as const;
export type LasaStatus = (typeof LASA_STATUSES)[number];

/** Filters for BFARS 4 (LASA). Empty strings mean "All". */
export interface LasaParams {
  fiscalYear: number;
  quarter: Quarter;
  department: string;
  allotmentClass: string;
  uacsMajor: string;
  status: string;
}

/** One allotment or sub-allotment, columns as in the LASA sample workbook and report. */
export interface LasaRow {
  allotmentNo: string;
  date: string;
  allotmentClass: AllotmentClassCode;
  uacsMajor: string;
  objectOfExpenditure: string;
  allottee: string;
  allotmentAmount: number;
  subAllotmentAmount: number;
  releasedAmount: number;
  status: LasaStatus;
  purpose: string;
}

export interface LasaReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  asOf: string;
  agency: string;
  fundSource: string;
  /** Agency appropriations for the fiscal year, for "% of Appropriations". */
  appropriations: number;
  rows: LasaRow[];
  signatories: SaaodbSignatory[];
  options: { departments: string[]; uacsMajors: { code: string; label: string }[] };
}
