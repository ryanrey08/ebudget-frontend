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

/**
 * DEMO CONTRACT, not the backend's. Used only by the demo obligation and RAO
 * registry pages (and the mock tests); every call is marked `demo` so it is
 * answered by the demo API even in real mode, because its paths collide with
 * the backend's. The backend contract lives in src/services/backend.
 */
/** Allotments (Appropriations › Allotments) and their approval workflow. */
export const allotmentsService = {
  getAll: (params: AllotmentListParams) => apiClient.get<Paginated<Allotment>>(ENDPOINTS.allotments.list, params, { demo: true }),
  getSummary: (params: { fiscalYear: number }) => apiClient.get<AllotmentSummary>(ENDPOINTS.allotments.summary, params, { demo: true }),
  getById: (id: string) => apiClient.get<AllotmentDetail>(ENDPOINTS.allotments.detail(id), undefined, { demo: true }),
  getNextNumber: (params: { fiscalYear: number }) => apiClient.get<{ allotmentNo: string }>(ENDPOINTS.allotments.nextNumber, params, { demo: true }),
  create: (payload: CreateAllotmentRequest) => apiClient.post<Allotment>(ENDPOINTS.allotments.list, payload, { demo: true }),
  /** submit / approve / return / reject / release / saveRemarks */
  workflow: ({ id, ...payload }: AllotmentWorkflowRequest) => apiClient.post<AllotmentDetail>(ENDPOINTS.allotments.workflow(id), payload, { demo: true }),
  delete: (id: string) => apiClient.delete<MessageResponse>(ENDPOINTS.allotments.detail(id), { demo: true }),
  uploadDocument: (arg: AllotmentDocumentUpload) => {
    const { file, category, description } = arg instanceof File ? { file: arg, category: undefined, description: undefined } : arg;
    return apiClient.upload<AllotmentDocument>(ENDPOINTS.allotments.documents, { file, category, description }, { demo: true });
  },
  attachDocument: ({ id, file }: { id: string; file: File }) => apiClient.upload<AllotmentDetail>(ENDPOINTS.allotments.attachDocument(id), { file }, { demo: true }),
  removeDocument: ({ id, docId }: { id: string; docId: string }) => apiClient.delete<AllotmentDetail>(ENDPOINTS.allotments.document(id, docId), { demo: true }),
};

/** Allotment classes (RAOPS, RAOMO, RAOCO, RAOFE) registries. */
export const allotmentClassesService = {
  getRegistry: ({ code, fiscalYear }: { code: AllotmentClassCode; fiscalYear: number }) =>
    apiClient.get<AllotmentClassRegistry>(ENDPOINTS.allotmentClasses.registry(code), { fiscalYear }, { demo: true }),
  getLookups: (code: string) => apiClient.get<RegistryLookups>(ENDPOINTS.allotmentClasses.lookups(code), undefined, { demo: true }),
  create: (payload: RegistryAllotmentInput) => apiClient.post<Allotment>(ENDPOINTS.allotments.registry, payload, { demo: true }),
  update: ({ id, ...payload }: RegistryAllotmentInput & { id: string }) => apiClient.put<Allotment>(ENDPOINTS.allotments.updateRegistry(id), payload, { demo: true }),
};
