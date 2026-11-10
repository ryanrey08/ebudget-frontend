import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { SaaodbSignatory } from "../saaodb/types";
import type { ObjectClass } from "../saaodboe/types";

/** Filters for BFARS 9 (Monthly Report of Disbursement). Empty strings mean "All". */
export interface MrdParams {
  fiscalYear: number;
  /** Reporting month, 1–12. */
  month: number;
  department: string;
  allotmentClass: string;
  /** UACS major, e.g. "502" (matches codes "5-02-…"). */
  uacsMajor: string;
}

/** One disbursement voucher, columns as in the BFARS 9 dashboard and transaction listing. */
export interface MrdRow {
  referenceNo: string;
  date: string;
  payee: string;
  uacsCode: string;
  objectOfExpenditure: string;
  /** PS / MOOE / CO / FE / Others (the report's columns). */
  objectClass: ObjectClass;
  allotmentClass: AllotmentClassCode;
  description: string;
  /** Office the disbursement is charged to (Department/Office filter). */
  office: string;
  fundSource: string;
  amount: number;
}

export interface MrdReport {
  fiscalYear: number;
  month: number;
  period: string;
  agency: string;
  /** Disbursements of the fiscal year from January through the end of the selected month. */
  rows: MrdRow[];
  signatories: SaaodbSignatory[];
  options: { departments: string[]; uacsMajors: { code: string; label: string }[] };
}
