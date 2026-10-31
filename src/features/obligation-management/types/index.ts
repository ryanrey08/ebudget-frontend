import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { PageParams } from "@/types/api";
import type { AppropriationDocument } from "@/features/appropriations/types";
import type { TrancheType } from "@/features/allotments/types";

/**
 * Draft → For Approval (Budget Head, Accountant) → Approved (awaiting Head of
 * Agency certification) → Released. Returned goes back to the encoder;
 * Cancelled ends the record.
 */
export const OBLIGATION_STATUSES = ["Draft", "For Approval", "Approved", "Released", "Returned", "Cancelled"] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export const OBLIGATION_STEPS = ["encode", "submit", "review", "accountant", "certification", "release"] as const;
export type ObligationStepKey = (typeof OBLIGATION_STEPS)[number];
export type ObligationStepStatus = "completed" | "current" | "pending" | "returned" | "rejected";

export interface ObligationStep {
  key: ObligationStepKey;
  status: ObligationStepStatus;
  actorName?: string;
  actorPosition?: string;
  actedAt?: string;
  remarks?: string;
  /** Remarks saved with "Save as Draft" before acting. */
  draftRemarks?: string;
  /** Typed name used as the digital signature on certification. */
  signature?: string;
}

export interface ObligationLineItem {
  id: string;
  uacsCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  amount: number;
}

export type ObligationDocument = AppropriationDocument;

export interface Obligation {
  id: string;
  referenceNo: string;
  fiscalYear: number;
  date: string;
  allotmentRef: string;
  allotmentClass: AllotmentClassCode;
  tranche: TrancheType;
  fundSource: string;
  responsibilityCenter: string;
  payee: string;
  tin: string;
  address: string;
  particulars: string;
  /** First line item's UACS code (kept for registries and reports). */
  uacsCode: string;
  lineItems: ObligationLineItem[];
  amount: number;
  appNo: string;
  prNo: string;
  poNo: string;
  modeOfProcurement: string;
  projectActivity: string;
  remarks: string;
  applicableDocuments: string[];
  documents: ObligationDocument[];
  disbursed: number;
  status: ObligationStatus;
  workflow: ObligationStep[];
}

export type ObligationTab = "approval" | "approved" | "released" | "cancelled" | "draft";

export interface ObligationListParams extends PageParams {
  fiscalYear: number;
  status?: ObligationStatus | "";
  tab?: ObligationTab | "";
  allotmentClass?: AllotmentClassCode | "";
  fundSource?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ObligationSummary {
  fiscalYear: number;
  allotmentTotal: number;
  totalObligations: number;
  obligatedAmount: number;
  pendingApproval: number;
  releasedAmount: number;
  totalDisbursed: number;
  count: number;
  byTab: Record<ObligationTab, number>;
  byClass: { allotmentClass: AllotmentClassCode; amount: number }[];
  monthly: { month: string; amount: number; released: number; count: number }[];
}

export interface AllotmentBalanceInfo {
  allotmentNo: string;
  amount: number;
  /** Other obligations charged to the allotment (drafts and cancelled excluded). */
  otherObligations: number;
  remaining: number;
}

export interface ObligationDetail {
  obligation: Obligation;
  allotment: AllotmentBalanceInfo | null;
}

export interface ObligationInput {
  date: string;
  allotmentRef: string;
  tranche: TrancheType;
  fundSource: string;
  responsibilityCenter: string;
  payee: string;
  tin: string;
  address: string;
  particulars: string;
  lineItems: Omit<ObligationLineItem, "id" | "amount">[];
  appNo: string;
  prNo: string;
  poNo: string;
  modeOfProcurement: string;
  projectActivity: string;
  remarks: string;
  applicableDocuments: string[];
  documentIds: string[];
}

export type ObligationAction = "submit" | "approve" | "back" | "return" | "reject" | "saveRemarks";

export interface ObligationWorkflowRequest {
  id: string;
  action: ObligationAction;
  remarks?: string;
  signature?: string;
}

/** Sample purchase requests / orders / APP entries that line items can be imported from. */
export interface ProcurementSource {
  type: "PR/PO" | "APP";
  referenceNo: string;
  prNo?: string;
  poNo?: string;
  appNo?: string;
  title: string;
  payee?: string;
  modeOfProcurement?: string;
  items: Omit<ObligationLineItem, "id" | "amount">[];
}

export interface ObligationLookups {
  units: string[];
  modesOfProcurement: string[];
  applicableDocuments: string[];
  payees: { name: string; tin: string; address: string }[];
  sources: ProcurementSource[];
}
