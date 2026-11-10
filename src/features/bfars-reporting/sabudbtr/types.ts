import type { Quarter } from "../qpro/types";
import type { SaaodbSignatory } from "../saaodb/types";

/** Filters for BFARS 11 (SABUDBTR). Empty strings mean "All". */
export interface SabudbtrParams {
  fiscalYear: number;
  quarter: Quarter | "";
  department: string;
  /** Trust receipt fund, e.g. "Student Fees". */
  fund: string;
  /** UACS code of the fund line, e.g. "4-01-01-01". */
  uacsMajor: string;
}

/** Utilizations and disbursements of one month (1–12). */
export interface SabudbtrMonth {
  month: number;
  utilizations: number;
  disbursements: number;
}

/**
 * One fund × activity line. Amounts are as of the end of the selected quarter: the approved budget is annual,
 * utilizations and disbursements are year-to-date. Balances are derived (see document.ts).
 */
export interface SabudbtrRow {
  fund: string;
  uacsCode: string;
  uacsDescription: string;
  /** Activity under the fund (Group by "Fund / Activity"). */
  activity: string;
  /** Office the activity belongs to (Department/Office filter). */
  office: string;
  approvedBudget: number;
  utilizations: number;
  disbursements: number;
  /** The selected quarter's three months. */
  monthly: SabudbtrMonth[];
}

export interface SabudbtrReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  agency: string;
  rows: SabudbtrRow[];
  /** The same lines as of the end of the preceding quarter (Q4 of the previous year for Q1); null when there is no data. */
  previousQuarter: { label: string; rows: SabudbtrRow[] } | null;
  signatories: SaaodbSignatory[];
  options: { departments: string[]; funds: string[]; uacsMajors: { code: string; label: string; fund: string }[] };
}
