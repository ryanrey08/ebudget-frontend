import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { approvalRequestsService, approvalWorkflowsService } from "@/services/backend";
import type { Paginated } from "@/types/api";
import type { ApprovalRequest, ApprovalWorkflow, ApprovalWorkflowInput, ApprovalWorkflowQuery } from "../types";

const WORKFLOWS = { type: "ApprovalWorkflow" as const, id: "LIST" };

export const approvalsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getApprovalWorkflows: build.query<Paginated<ApprovalWorkflow>, ApprovalWorkflowQuery>({
      queryFn: (q) => fromService(() => approvalWorkflowsService.list(q)),
      providesTags: (result) => [WORKFLOWS, ...(result?.items.map((w) => ({ type: "ApprovalWorkflow" as const, id: w.id })) ?? [])],
    }),
    getApprovalWorkflow: build.query<ApprovalWorkflow, string>({
      queryFn: (id) => fromService(() => approvalWorkflowsService.get(id)),
      providesTags: (_r, _e, id) => [{ type: "ApprovalWorkflow", id }],
    }),
    createApprovalWorkflow: build.mutation<ApprovalWorkflow, ApprovalWorkflowInput>({
      queryFn: (input) => fromService(() => approvalWorkflowsService.create(input)),
      invalidatesTags: [WORKFLOWS],
    }),
    updateApprovalWorkflow: build.mutation<ApprovalWorkflow, { id: string; input: ApprovalWorkflowInput }>({
      queryFn: ({ id, input }) => fromService(() => approvalWorkflowsService.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [WORKFLOWS, { type: "ApprovalWorkflow", id }],
    }),
    deleteApprovalWorkflow: build.mutation<null, string>({
      queryFn: (id) => fromService(() => approvalWorkflowsService.remove(id)),
      invalidatesTags: [WORKFLOWS],
    }),

    getApprovalRequest: build.query<ApprovalRequest, string>({
      queryFn: (id) => fromService(() => approvalRequestsService.get(id)),
      providesTags: (_r, _e, id) => [{ type: "ApprovalRequest", id }],
    }),
    /** Deciding a step changes the record (e.g. the tranche becomes released). */
    approveApprovalStep: build.mutation<ApprovalRequest, { id: string; stepId: string; signature?: Blob | null; remarks?: string }>({
      queryFn: ({ id, stepId, ...input }) => fromService(() => approvalRequestsService.approve(id, stepId, input)),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "ApprovalRequest", id },
        { type: "AllotmentRecord", id: "LIST" },
        "AllotmentRecord",
        { type: "AppropriationLine", id: "LIST" },
      ],
    }),
    rejectApprovalStep: build.mutation<ApprovalRequest, { id: string; stepId: string; remarks: string }>({
      queryFn: ({ id, stepId, remarks }) => fromService(() => approvalRequestsService.reject(id, stepId, remarks)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "ApprovalRequest", id }, { type: "AllotmentRecord", id: "LIST" }, "AllotmentRecord"],
    }),
  }),
});

export const {
  useGetApprovalWorkflowsQuery,
  useGetApprovalWorkflowQuery,
  useCreateApprovalWorkflowMutation,
  useUpdateApprovalWorkflowMutation,
  useDeleteApprovalWorkflowMutation,
  useGetApprovalRequestQuery,
  useApproveApprovalStepMutation,
  useRejectApprovalStepMutation,
} = approvalsApi;
