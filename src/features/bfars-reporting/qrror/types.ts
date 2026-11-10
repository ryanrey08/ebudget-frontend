import type { Quarter } from "../qpro/types";
import type { SaaodbSignatory } from "../saaodb/types";

/** Revenue classification codes (UACS 4-01 / 4-02 / 4-03) of the BFARS 10 report. */
export type RevenueClass = "4-01" | "4-02" | "4-03";

/** Filters for BFARS 10 (Quarterly Report of Revenue and Other Receipts). Empty strings mean "All". */
export interface QrrorParams {
  fiscalYear: number;
  quarter: Quarter | "";
  department: string;
  /** Revenue classification code, e.g. "4-01". */
  classification: string;
  /** UACS account, e.g. "4-01-01". */
  uacsMajor: string;
}

/** One receipt, columns as in the BFARS 10 dashboard and the sample workbook's transactions. */
export interface QrrorRow {
  referenceNo: string;
  date: string;
  classification: RevenueClass;
  uacsCode: string;
  description: string;
  /** Office the receipt is credited to (Department/Office filter). */
  office: string;
  amount: number;
}

export interface QrrorReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  agency: string;
  /** Receipts of the fiscal year from January through the end of the selected quarter. */
  rows: QrrorRow[];
  /** Receipts of the quarter before the selected one (Q4 of the previous year for Q1); null when there is no data. */
  previousQuarter: { label: string; rows: QrrorRow[] } | null;
  /** Receipts of the same quarter of the previous fiscal year; null when there is no data. */
  previousYear: { label: string; rows: QrrorRow[] } | null;
  signatories: SaaodbSignatory[];
  options: { departments: string[]; uacsMajors: { code: string; label: string; classification: RevenueClass }[] };
}
