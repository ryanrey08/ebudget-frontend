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

/** Appropriation records, balances and lookups (fund sources, PAPs, offices…). */
export const appropriationsService = {
  getAll: (params: AppropriationListParams) => apiClient.get<Paginated<Appropriation>>(ENDPOINTS.appropriations.list, params),
  getSummary: (params: { fiscalYear: number }) => apiClient.get<AppropriationSummary>(ENDPOINTS.appropriations.summary, params),
  getLookups: () => apiClient.get<AppropriationLookups>(ENDPOINTS.appropriations.lookups),
  create: (payload: CreateAppropriationRequest) => apiClient.post<Appropriation>(ENDPOINTS.appropriations.list, payload),
  /** Deletes a draft or an appropriation without allotments (409 otherwise). */
  delete: (id: string) => apiClient.delete<MessageResponse>(ENDPOINTS.appropriations.detail(id)),
  uploadDocument: (file: File) => apiClient.upload<AppropriationDocument>(ENDPOINTS.appropriations.documents, { file }),
};

/** GAA Upload: Upload → Validate → Map & Configure → Import. */
export const gaaService = {
  getUploads: () => apiClient.get<GaaUploadBatch[]>(ENDPOINTS.gaa.uploads),
  getUpload: (id: string) => apiClient.get<GaaUploadBatch>(ENDPOINTS.gaa.upload(id)),
  getRows: (id: string) => apiClient.get<GaaRow[]>(ENDPOINTS.gaa.rows(id)),
  getColumns: (id: string) => apiClient.get<GaaSourceColumn[]>(ENDPOINTS.gaa.columns(id)),
  getImportResult: (id: string) => apiClient.get<ImportGaaResponse>(ENDPOINTS.gaa.import(id)),
  upload: ({ file, fiscalYear }: UploadGaaRequest) => apiClient.upload<GaaUploadBatch>(ENDPOINTS.gaa.uploads, { file, fiscalYear }),
  validate: (id: string) => apiClient.post<GaaValidationSummary>(ENDPOINTS.gaa.validate(id)),
  import: ({ id, ...payload }: ImportGaaRequest) => apiClient.post<ImportGaaResponse>(ENDPOINTS.gaa.import(id), payload),
  delete: (id: string) => apiClient.delete<MessageResponse>(ENDPOINTS.gaa.upload(id)),
};
