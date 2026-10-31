import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type QproStatus = "On Track" | "Needs Attention" | "At Risk";

/** Filters and report parameters for BFARS 1 (QPRO). Empty strings mean "All". */
export interface QproParams {
  fiscalYear: number;
  quarter: Quarter;
  department: string;
  uacsMajor: string;
  allotmentClass: string;
  pap: string;
  fundSource: string;
  status: string;
}

/** One program/activity/project row, following the columns of the QPRO sample workbook. */
export interface QproRow {
  code: string;
  pap: string;
  papTitle: string;
  program: string;
  allotmentClass: AllotmentClassCode;
  uacsMajor: string;
  department: string;
  fundSource: string;
  programType: string;
  physicalTarget: number;
  physicalActual: number;
  allotment: number;
  obligations: number;
  disbursements: number;
  status: QproStatus;
}

export interface QproReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  asOf: string;
  agency: string;
  rows: QproRow[];
  /** Programs/activities in the same quarter of the previous fiscal year (same filters). */
  previousCount: number | null;
  options: {
    departments: string[];
    uacsMajors: string[];
    paps: { code: string; title: string }[];
    fundSources: { code: string; name: string }[];
    statuses: QproStatus[];
  };
}
