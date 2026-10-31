import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";

export interface DashboardSummary {
  fiscalYear: number;
  totalAppropriations: number;
  totalAllotments: number;
  totalObligations: number;
  totalDisbursements: number;
  availableBalance: number;
}

export interface ClassUtilization {
  allotmentClass: AllotmentClassCode;
  appropriations: number;
  allotments: number;
  obligations: number;
}

export interface ClassAllocation {
  allotmentClass: AllotmentClassCode;
  amount: number;
}

export interface DashboardOverview {
  summary: DashboardSummary;
  utilization: ClassUtilization[];
  allocation: ClassAllocation[];
}

export type TransactionType = "Appropriation" | "Allotment" | "Obligation" | "Disbursement";
export type TransactionStatus = "Posted" | "Approved" | "Pending" | "Cancelled";

export interface Transaction {
  id: string;
  date: string;
  referenceNo: string;
  type: TransactionType;
  description: string;
  amount: number;
  status: TransactionStatus;
}
