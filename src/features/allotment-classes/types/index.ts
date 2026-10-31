import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { ObligationStatus } from "@/features/obligation-management/types";

/** One obligation recorded against an allotment of this class. */
export interface RegistryEntry {
  id: string;
  date: string;
  obligationRef: string;
  allotmentNo: string;
  uacsCode: string;
  particulars: string;
  payee: string;
  obligation: number;
  disbursement: number;
  status: ObligationStatus;
}

export interface RegistryAllotment {
  allotmentNo: string;
  objectOfExpenditure: string;
  amount: number;
  obligated: number;
}

export interface AllotmentClassRegistry {
  code: AllotmentClassCode;
  fiscalYear: number;
  summary: {
    allotments: number;
    obligations: number;
    disbursements: number;
    unobligatedBalance: number;
  };
  allotments: RegistryAllotment[];
  monthly: { month: string; obligations: number; disbursements: number }[];
  entries: RegistryEntry[];
}
