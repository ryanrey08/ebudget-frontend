import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { SaaodbSignatory } from "../saaodb/types";

/** Object of expenditure groups used by the report's donut ("Others" is anything outside PS, MOOE and CO). */
export type AuoObject = "PS" | "MOOE" | "CO" | "Others";

/** Filters for BFARS 8 (Aging of Unpaid Obligations). Empty strings mean "All". */
export interface AuoParams {
  fiscalYear: number;
  /** ISO date the obligations are aged to, e.g. "2026-03-31". */
  asOf: string;
  department: string;
  allotmentClass: string;
  /** UACS major, e.g. "502" (matches codes "5-02-…"). */
  uacsMajor: string;
}

/** One unpaid obligation, columns as in the BFARS 8 report and dashboard. */
export interface AuoRow {
  referenceNo: string;
  dateObligated: string;
  /** Date payment falls due; aging is counted from this date. */
  dueDate: string;
  payee: string;
  objectOfExpenditure: AuoObject;
  allotmentClass: AllotmentClassCode;
  uacsCode: string;
  description: string;
  /** Office the obligation is charged to (Department/Office filter). */
  office: string;
  /** Unpaid amount as of the report date. */
  amount: number;
}

export interface AuoReport {
  fiscalYear: number;
  asOf: string;
  period: string;
  agency: string;
  rows: AuoRow[];
  signatories: SaaodbSignatory[];
  options: { departments: string[]; uacsMajors: { code: string; label: string }[] };
}
