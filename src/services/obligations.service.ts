import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse, Paginated } from "@/types/api";
import type {
  Obligation,
  ObligationDetail,
  ObligationDocument,
  ObligationInput,
  ObligationListParams,
  ObligationLookups,
  ObligationSummary,
  ObligationWorkflowRequest,
} from "@/features/obligation-management/types";

/** Obligation requests, supporting documents and the approval workflow. */
export const obligationsService = {
  getAll: (params: ObligationListParams) => apiClient.get<Paginated<Obligation>>(ENDPOINTS.obligations.list, params),
  getSummary: (params: { fiscalYear: number }) => apiClient.get<ObligationSummary>(ENDPOINTS.obligations.summary, params),
  getLookups: () => apiClient.get<ObligationLookups>(ENDPOINTS.obligations.lookups),
  getNextNumber: (params: { fiscalYear: number }) => apiClient.get<{ referenceNo: string }>(ENDPOINTS.obligations.nextNumber, params),
  /** Detail including approval history (`history`) and documents. */
  getById: (id: string) => apiClient.get<ObligationDetail>(ENDPOINTS.obligations.detail(id)),
  create: (payload: ObligationInput) => apiClient.post<Obligation>(ENDPOINTS.obligations.list, payload),
  /** Drafts and returned requests only. */
  update: ({ id, ...payload }: ObligationInput & { id: string }) => apiClient.put<Obligation>(ENDPOINTS.obligations.detail(id), payload),
  /** submit / approve / return / reject / certify / saveRemarks */
  workflow: ({ id, ...payload }: ObligationWorkflowRequest) => apiClient.post<ObligationDetail>(ENDPOINTS.obligations.workflow(id), payload),
  delete: (id: string) => apiClient.delete<MessageResponse>(ENDPOINTS.obligations.detail(id)),
  uploadDocument: (file: File) => apiClient.upload<ObligationDocument>(ENDPOINTS.obligations.documents, { file }),
};
