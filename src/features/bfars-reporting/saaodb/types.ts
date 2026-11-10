import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { Quarter } from "../qpro/types";

/** Filters for BFARS 2 (SAAODB). Empty strings mean "All". */
export interface SaaodbParams {
  fiscalYear: number;
  quarter: Quarter;
  department: string;
  uacsMajor: string;
  allotmentClass: string;
}

/** One allotment class × object of expenditure line, columns as in the SAAODB sample workbook. */
export interface SaaodbRow {
  allotmentClass: AllotmentClassCode;
  uacsMajor: string;
  objectOfExpenditure: string;
  appropriations: number;
  allotments: number;
  obligations: number;
  disbursements: number;
  remarks: string;
}

export interface SaaodbSignatory {
  role: string;
  name: string;
  position: string;
}

export interface SaaodbReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  asOf: string;
  agency: string;
  fundSource: string;
  rows: SaaodbRow[];
  signatories: SaaodbSignatory[];
  options: { departments: string[]; uacsMajors: { code: string; label: string }[] };
}
