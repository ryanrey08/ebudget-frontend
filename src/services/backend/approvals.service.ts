import { BACKEND, backendPath } from "@/lib/api/endpoints";
import type { Paginated } from "@/types/api";
import type { ApprovalRequest, ApprovalWorkflow, ApprovalWorkflowInput, ApprovalWorkflowQuery } from "@/features/approvals/types";
import { backend, compact } from "./http";

export const approvalWorkflowsService = {
  list: (query: ApprovalWorkflowQuery) => backend.get<Paginated<ApprovalWorkflow>>(BACKEND.approvalWorkflows, compact(query)),
  get: (id: string) => backend.get<ApprovalWorkflow>(BACKEND.approvalWorkflow(id)),
  create: (input: ApprovalWorkflowInput) => backend.post<ApprovalWorkflow>(BACKEND.approvalWorkflows, input),
  update: (id: string, input: ApprovalWorkflowInput) => backend.patch<ApprovalWorkflow>(BACKEND.approvalWorkflow(id), input),
  /** 409 approval_workflow_in_use once a request has used it. */
  remove: (id: string) => backend.delete(BACKEND.approvalWorkflow(id)),
};

/**
 * Approval requests. The backend has no list endpoint: a request is reached
 * from its record (e.g. an allotment tranche's `approval.id`).
 */
export const approvalRequestsService = {
  get: (id: string) => backend.get<ApprovalRequest>(BACKEND.approvalRequest(id)),
  /** multipart: `signature` (PNG/JPEG ≤ 1 MB) only when the step names a signatory. */
  approve: (id: string, stepId: string, input: { signature?: Blob | null; remarks?: string }) =>
    backend.upload<ApprovalRequest>(BACKEND.approvalStepApprove(id, stepId), {
      signature: input.signature ?? undefined,
      remarks: input.remarks?.trim() || undefined,
    }),
  reject: (id: string, stepId: string, remarks: string) => backend.post<ApprovalRequest>(BACKEND.approvalStepReject(id, stepId), { remarks }),
  /** The signature image of a signed step (needs the token). */
  signature: (signatureUrl: string) => backend.download(backendPath(signatureUrl), "signature"),
};
