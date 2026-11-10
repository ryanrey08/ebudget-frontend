import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { MessageResponse, Paginated } from "@/types/api";
import type { AllotmentClassRegistry } from "@/features/allotment-classes/types";
import type {
  Allotment,
  AllotmentDetail,
  AllotmentDocument,
  AllotmentListParams,
  AllotmentSummary,
  AllotmentWorkflowRequest,
  CreateAllotmentRequest,
  RegistryAllotmentInput,
  RegistryLookups,
} from "@/features/allotments/types";

export type AllotmentDocumentUpload = File | { file: File; category?: string; description?: string };

/** Allotments (Appropriations › Allotments) and their approval workflow. */
export const allotmentsService = {
  getAll: (params: AllotmentListParams) => apiClient.get<Paginated<Allotment>>(ENDPOINTS.allotments.list, params),
  getSummary: (params: { fiscalYear: number }) => apiClient.get<AllotmentSummary>(ENDPOINTS.allotments.summary, params),
  getById: (id: string) => apiClient.get<AllotmentDetail>(ENDPOINTS.allotments.detail(id)),
  getNextNumber: (params: { fiscalYear: number }) => apiClient.get<{ allotmentNo: string }>(ENDPOINTS.allotments.nextNumber, params),
  create: (payload: CreateAllotmentRequest) => apiClient.post<Allotment>(ENDPOINTS.allotments.list, payload),
  /** submit / approve / return / reject / release / saveRemarks */
  workflow: ({ id, ...payload }: AllotmentWorkflowRequest) => apiClient.post<AllotmentDetail>(ENDPOINTS.allotments.workflow(id), payload),
  delete: (id: string) => apiClient.delete<MessageResponse>(ENDPOINTS.allotments.detail(id)),
  uploadDocument: (arg: AllotmentDocumentUpload) => {
    const { file, category, description } = arg instanceof File ? { file: arg, category: undefined, description: undefined } : arg;
    return apiClient.upload<AllotmentDocument>(ENDPOINTS.allotments.documents, { file, category, description });
  },
  attachDocument: ({ id, file }: { id: string; file: File }) => apiClient.upload<AllotmentDetail>(ENDPOINTS.allotments.attachDocument(id), { file }),
  removeDocument: ({ id, docId }: { id: string; docId: string }) => apiClient.delete<AllotmentDetail>(ENDPOINTS.allotments.document(id, docId)),
};

/** Allotment classes (RAOPS, RAOMO, RAOCO, RAOFE) registries. */
export const allotmentClassesService = {
  getRegistry: ({ code, fiscalYear }: { code: AllotmentClassCode; fiscalYear: number }) =>
    apiClient.get<AllotmentClassRegistry>(ENDPOINTS.allotmentClasses.registry(code), { fiscalYear }),
  getLookups: (code: string) => apiClient.get<RegistryLookups>(ENDPOINTS.allotmentClasses.lookups(code)),
  create: (payload: RegistryAllotmentInput) => apiClient.post<Allotment>(ENDPOINTS.allotments.registry, payload),
  update: ({ id, ...payload }: RegistryAllotmentInput & { id: string }) => apiClient.put<Allotment>(ENDPOINTS.allotments.updateRegistry(id), payload),
};
