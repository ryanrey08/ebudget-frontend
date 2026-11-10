import type { Quarter } from "../qpro/types";
import type { SaaodbSignatory } from "../saaodb/types";

export const SODLBIAFT_STATUSES = ["On Track", "Monitor", "For Liquidation"] as const;
export type SodlbiaftStatus = (typeof SODLBIAFT_STATUSES)[number];

/** Filters for BFARS 5 (SODLBIAFT). Empty strings mean "All". */
export interface SodlbiaftParams {
  fiscalYear: number;
  quarter: Quarter;
  office: string;
  sourceAgency: string;
  program: string;
}

/** One fund transfer received from another government agency, columns as in the BFARS 5 mockups. */
export interface SodlbiaftRow {
  /** Source agency code, e.g. "DOST" ("Others" for various agencies). */
  sourceAgency: string;
  /** Project funded by the transfer, e.g. "Research Equipment Upgrade". */
  project: string;
  /** Program/Project category used for the filter and the distribution chart. */
  program: string;
  office: string;
  referenceNo: string;
  dateReceived: string;
  fundsReceived: number;
  obligations: number;
  disbursements: number;
  liquidations: number;
  status: SodlbiaftStatus;
}

export interface SodlbiaftReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  asOf: string;
  agency: string;
  fundSource: string;
  rows: SodlbiaftRow[];
  signatories: SaaodbSignatory[];
  options: {
    offices: string[];
    /** Source agencies in report order, with their full names. */
    sourceAgencies: { code: string; name: string }[];
    programs: string[];
  };
}
