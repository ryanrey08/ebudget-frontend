/**
 * Approvals: workflows (setup, /system-administration/approval-workflows) and
 * requests (one submission, /approval-requests/{id}). Mirrors
 * ApprovalWorkflowResource and ApprovalRequestResource.
 */
import type { BackendPageQuery, IsoDateTime, Ulid, UserRef } from "@/types/backend";

/** App\Enums\EBudget\ApprovalModule */
export type ApprovalModule = "allotment" | "obligation_request" | "budget_realignment";
export const APPROVAL_MODULES: { value: ApprovalModule; label: string }[] = [
  { value: "allotment", label: "Allotment" },
  { value: "obligation_request", label: "Obligation Request" },
  { value: "budget_realignment", label: "Budget Realignment" },
];

export interface WorkflowStep {
  id: Ulid;
  sequence: number;
  name: string;
  user: UserRef;
  signatory: { id: Ulid; position: string } | null;
}

export interface ApprovalWorkflow {
  id: Ulid;
  module: ApprovalModule;
  module_label: string;
  name: string;
  is_active: boolean;
  steps: WorkflowStep[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ApprovalWorkflowQuery extends BackendPageQuery {
  module?: ApprovalModule;
  is_active?: 0 | 1;
}

export interface ApprovalWorkflowInput {
  /** Create only: can't be changed later. */
  module?: ApprovalModule;
  name?: string;
  is_active?: boolean;
  /** Replaces every step, in order. 1 to 20. */
  steps?: { name: string; user_id: Ulid; signatory_id?: Ulid | null }[];
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequestStep {
  id: Ulid;
  sequence: number;
  name: string;
  user: UserRef;
  signatory: { id: Ulid; position: string } | null;
  /** Show the signature pad when the current step requires it. */
  requires_signature: boolean;
  status: ApprovalStatus;
  remarks: string | null;
  acted_at: IsoDateTime | null;
  signed_position: string | null;
  /** Needs the token: fetch through the data proxy, show as a blob URL. */
  signature_url: string | null;
}

export interface ApprovalRequest {
  id: Ulid;
  module: ApprovalModule;
  module_label: string;
  record_id: Ulid;
  status: ApprovalStatus;
  remarks: string | null;
  submitted_by: UserRef;
  submitted_at: IsoDateTime;
  completed_at: IsoDateTime | null;
  current_step_id: Ulid | null;
  steps: ApprovalRequestStep[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}
