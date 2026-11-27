import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse, Paginated } from "@/types/api";
import type {
  Appropriation,
  AppropriationDocument,
  AppropriationListParams,
  AppropriationLookups,
  AppropriationSummary,
  CreateAppropriationRequest,
  GaaRow,
  GaaSourceColumn,
  GaaUploadBatch,
  GaaValidationSummary,
  ImportGaaRequest,
  ImportGaaResponse,
  UploadGaaRequest,
} from "@/features/appropriations/types";

/**
 * DEMO CONTRACT, not the backend's. Used only by the demo obligation and RAO
 * registry pages (and the mock tests); every call is marked `demo` so it is
 * answered by the demo API even in real mode, because its paths collide with
 * the backend's. The backend contract lives in src/services/backend.
 */
/** Appropriation records, balances and lookups (fund sources, PAPs, offices…). */
export const appropriationsService = {
  getAll: (params: AppropriationListParams) => apiClient.get<Paginated<Appropriation>>(ENDPOINTS.appropriations.list, params, { demo: true }),
  getSummary: (params: { fiscalYear: number }) => apiClient.get<AppropriationSummary>(ENDPOINTS.appropriations.summary, params, { demo: true }),
  getLookups: () => apiClient.get<AppropriationLookups>(ENDPOINTS.appropriations.lookups, undefined, { demo: true }),
  create: (payload: CreateAppropriationRequest) => apiClient.post<Appropriation>(ENDPOINTS.appropriations.list, payload, { demo: true }),
  /** Deletes a draft or an appropriation without allotments (409 otherwise). */
  delete: (id: string) => apiClient.delete<MessageResponse>(ENDPOINTS.appropriations.detail(id), { demo: true }),
  uploadDocument: (file: File) => apiClient.upload<AppropriationDocument>(ENDPOINTS.appropriations.documents, { file }, { demo: true }),
};

/** GAA Upload: Upload → Validate → Map & Configure → Import. */
export const gaaService = {
  getUploads: () => apiClient.get<GaaUploadBatch[]>(ENDPOINTS.gaa.uploads, undefined, { demo: true }),
  getUpload: (id: string) => apiClient.get<GaaUploadBatch>(ENDPOINTS.gaa.upload(id), undefined, { demo: true }),
  getRows: (id: string) => apiClient.get<GaaRow[]>(ENDPOINTS.gaa.rows(id), undefined, { demo: true }),
  getColumns: (id: string) => apiClient.get<GaaSourceColumn[]>(ENDPOINTS.gaa.columns(id), undefined, { demo: true }),
  getImportResult: (id: string) => apiClient.get<ImportGaaResponse>(ENDPOINTS.gaa.import(id), undefined, { demo: true }),
  upload: ({ file, fiscalYear }: UploadGaaRequest) => apiClient.upload<GaaUploadBatch>(ENDPOINTS.gaa.uploads, { file, fiscalYear }, { demo: true }),
  validate: (id: string) => apiClient.post<GaaValidationSummary>(ENDPOINTS.gaa.validate(id), undefined, { demo: true }),
  import: ({ id, ...payload }: ImportGaaRequest) => apiClient.post<ImportGaaResponse>(ENDPOINTS.gaa.import(id), payload, { demo: true }),
  delete: (id: string) => apiClient.delete<MessageResponse>(ENDPOINTS.gaa.upload(id), { demo: true }),
};
