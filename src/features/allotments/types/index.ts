import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { PageParams } from "@/types/api";
import type { AppropriationDocument } from "@/features/appropriations/types";

export type AllotmentDocument = AppropriationDocument;

/**
 * Draft → For Approval (Budget Head, Accountant, Head of Agency) → Unreleased
 * (certified, awaiting release) → Released / Partial. Returned and Rejected
 * end the approval round.
 */
export const ALLOTMENT_STATUSES = [
  "Draft",
  "For Approval",
  "Unreleased",
  "Partial",
  "Released",
  "Returned",
  "Rejected",
] as const;
export type AllotmentStatus = (typeof ALLOTMENT_STATUSES)[number];

export const TRANCHE_TYPES = ["1st Tranche", "2nd Tranche", "3rd Tranche", "4th Tranche", "Full Release"] as const;
export type TrancheType = (typeof TRANCHE_TYPES)[number];

export const WORKFLOW_STEPS = ["prepared", "review", "accountant", "certification", "release"] as const;
/** Allotment-class registry workflow (RAOPS screens): Encode → Submit → Review → Accountant → Certification. */
export const REGISTRY_WORKFLOW_STEPS = ["prepared", "submit", "review", "accountant", "certification"] as const;
export type WorkflowStepKey = (typeof WORKFLOW_STEPS)[number] | (typeof REGISTRY_WORKFLOW_STEPS)[number];
export type WorkflowStepStatus = "completed" | "current" | "pending" | "returned" | "rejected";

export interface WorkflowStep {
  key: WorkflowStepKey;
  status: WorkflowStepStatus;
  actorName?: string;
  actorPosition?: string;
  actedAt?: string;
  remarks?: string;
  /** Remarks saved with "Save as Draft" before acting. */
  draftRemarks?: string;
  /** Typed-name digital signature. */
  signature?: string;
  /** Submission details captured on the submit step. */
  submission?: { nextApprover: string; targetDate: string; priority: string };
}

export interface AllotmentLineItem {
  id: string;
  uacsCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  amount: number;
  remarks: string;
  /** Line item category (RAOFE). */
  category?: string;
}

export interface AllotmentRelease {
  releaseNo: string;
  releaseDate: string;
  mdsReferenceNo?: string;
  releasedAt?: string;
}

export interface Allotment {
  id: string;
  allotmentNo: string;
  fiscalYear: number;
  /** Date the allotment was prepared. */
  date: string;
  appropriationRef: string;
  appropriationTitle: string;
  orgCode: string;
  office: string;
  program: string;
  uacsCode: string;
  objectOfExpenditure: string;
  allotmentClass: AllotmentClassCode;
  fundSource: string;
  amount: number;
  tranche: TrancheType;
  releaseAmount: number;
  releaseDate: string;
  /** Amount actually released (set when the release step is approved). */
  released: number;
  obligated: number;
  purpose: string;
  documents: AllotmentDocument[];
  status: AllotmentStatus;
  workflow: WorkflowStep[];
  release?: AllotmentRelease;
  /** "registry" records are encoded from an allotment-class page (e.g. RAOPS) with line items. */
  workflowType?: "standard" | "registry";
  lineItems?: AllotmentLineItem[];
  department?: string;
  responsibilityCenter?: string;
  gaaReferenceNo?: string;
  remarks?: string;
  /** Schedule/validity captured on some allotment-class forms (RAOMO). */
  effectivityDate?: string;
  validityDate?: string;
  /** Documents the encoder marked as required/attached (RAOCO checklist). */
  requiredDocuments?: string[];
}

export type AllotmentStatusGroup = "released" | "partial" | "unreleased" | "approval" | "draft";

export interface AllotmentListParams extends PageParams {
  fiscalYear: number;
  allotmentClass?: AllotmentClassCode | "";
  fundSource?: string;
  program?: string;
  department?: string;
  status?: AllotmentStatus | "";
  group?: AllotmentStatusGroup | "";
}

export interface AllotmentSummary {
  fiscalYear: number;
  appropriationTotal: number;
  totalAllotments: number;
  totalReleased: number;
  unreleased: number;
  count: number;
  byGroup: Record<AllotmentStatusGroup, number>;
  byClass: { allotmentClass: AllotmentClassCode; amount: number }[];
  monthly: { month: string; allotted: number; released: number; unreleased: number }[];
}

export interface AppropriationBalance {
  referenceNo: string;
  title: string;
  status: string;
  amount: number;
  /** Allotments counted against the appropriation (drafts and rejected excluded). */
  totalAllotted: number;
  remaining: number;
}

export interface AllotmentDetail {
  allotment: Allotment;
  appropriation: AppropriationBalance | null;
}

export interface CreateAllotmentRequest {
  fiscalYear: number;
  appropriationRef: string;
  allotmentClass: AllotmentClassCode;
  fundSource: string;
  amount: number;
  tranche: TrancheType;
  releaseAmount: number;
  releaseDate: string;
  purpose: string;
  documentIds: string[];
  /** Save without submitting; skips required-field checks. */
  draft: boolean;
}

export type WorkflowAction = "submit" | "approve" | "return" | "reject" | "saveRemarks";

export interface AllotmentWorkflowRequest {
  id: string;
  action: WorkflowAction;
  remarks?: string;
  signature?: string;
  submission?: WorkflowStep["submission"];
  /** Release step only. */
  releaseDate?: string;
  mdsReferenceNo?: string;
}

/** Input for allotments encoded from an allotment-class page (registry workflow). */
export interface RegistryAllotmentInput {
  fiscalYear: number;
  appropriationRef: string;
  allotmentClass: AllotmentClassCode;
  tranche: TrancheType;
  date: string;
  gaaReferenceNo: string;
  department: string;
  responsibilityCenter: string;
  fundSource: string;
  uacsCode: string;
  purpose: string;
  remarks: string;
  lineItems: Omit<AllotmentLineItem, "id" | "amount">[];
  documentIds: string[];
  effectivityDate?: string;
  validityDate?: string;
  /** Total allotment amount when it is entered separately from the line items (RAOCO). */
  amount?: number;
  requiredDocuments?: string[];
}

export interface RegistryLookups {
  departments: string[];
  documentCategories: string[];
  requiredDocuments: string[];
  priorities: string[];
  approvers: { step: WorkflowStepKey; label: string }[];
  /** Line item categories (RAOFE). */
  lineCategories?: string[];
}
