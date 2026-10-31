import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse } from "@/types/api";
import type {
  GaaRow,
  GaaSourceColumn,
  GaaUploadBatch,
  GaaValidationSummary,
  ImportGaaRequest,
  ImportGaaResponse,
  UploadGaaRequest,
} from "../types";

export const gaaApi = api.injectEndpoints({
  endpoints: (build) => ({
    getGaaUploads: build.query<GaaUploadBatch[], void>({
      query: () => ENDPOINTS.gaa.uploads,
      providesTags: (result) => [
        { type: "GaaUpload", id: "LIST" },
        ...(result?.map((b) => ({ type: "GaaUpload" as const, id: b.id })) ?? []),
      ],
    }),
    getGaaUpload: build.query<GaaUploadBatch, string>({
      query: (id) => ENDPOINTS.gaa.upload(id),
      providesTags: (_r, _e, id) => [{ type: "GaaUpload", id }],
    }),
    getGaaRows: build.query<GaaRow[], string>({
      query: (id) => ENDPOINTS.gaa.rows(id),
      providesTags: (_r, _e, id) => [{ type: "GaaUpload", id: `${id}-rows` }],
    }),
    getGaaColumns: build.query<GaaSourceColumn[], string>({
      query: (id) => ENDPOINTS.gaa.columns(id),
    }),
    getGaaImportResult: build.query<ImportGaaResponse, string>({
      query: (id) => ENDPOINTS.gaa.import(id),
      providesTags: (_r, _e, id) => [{ type: "GaaUpload", id: `${id}-result` }],
    }),
    uploadGaa: build.mutation<GaaUploadBatch, UploadGaaRequest>({
      query: ({ file, fiscalYear }) => {
        const body = new FormData();
        body.append("file", file);
        body.append("fiscalYear", String(fiscalYear));
        return { url: ENDPOINTS.gaa.uploads, method: "POST", body };
      },
      invalidatesTags: [{ type: "GaaUpload", id: "LIST" }],
    }),
    validateGaa: build.mutation<GaaValidationSummary, string>({
      query: (id) => ({ url: ENDPOINTS.gaa.validate(id), method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "GaaUpload", id },
        { type: "GaaUpload", id: `${id}-rows` },
        { type: "GaaUpload", id: "LIST" },
      ],
    }),
    importGaa: build.mutation<ImportGaaResponse, ImportGaaRequest>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.gaa.import(id), method: "POST", body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "GaaUpload", id: "LIST" },
        { type: "GaaUpload", id },
        { type: "GaaUpload", id: `${id}-result` },
        { type: "Appropriation", id: "LIST" },
        { type: "Appropriation", id: "SUMMARY" },
        "Dashboard",
      ],
    }),
    deleteGaaUpload: build.mutation<MessageResponse, string>({
      query: (id) => ({ url: ENDPOINTS.gaa.upload(id), method: "DELETE" }),
      invalidatesTags: [{ type: "GaaUpload", id: "LIST" }],
    }),
  }),
});

export const {
  useGetGaaUploadsQuery,
  useGetGaaUploadQuery,
  useGetGaaRowsQuery,
  useGetGaaColumnsQuery,
  useGetGaaImportResultQuery,
  useUploadGaaMutation,
  useValidateGaaMutation,
  useImportGaaMutation,
  useDeleteGaaUploadMutation,
} = gaaApi;
