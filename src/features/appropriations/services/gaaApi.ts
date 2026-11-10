import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { gaaService } from "@/services/appropriations.service";
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

/** RTK Query cache for the GAA Upload workflow; requests are made by gaaService. */
export const gaaApi = api.injectEndpoints({
  endpoints: (build) => ({
    getGaaUploads: build.query<GaaUploadBatch[], void>({
      queryFn: () => fromService(() => gaaService.getUploads()),
      providesTags: (result) => [
        { type: "GaaUpload", id: "LIST" },
        ...(result?.map((b) => ({ type: "GaaUpload" as const, id: b.id })) ?? []),
      ],
    }),
    getGaaUpload: build.query<GaaUploadBatch, string>({
      queryFn: (id) => fromService(() => gaaService.getUpload(id)),
      providesTags: (_r, _e, id) => [{ type: "GaaUpload", id }],
    }),
    getGaaRows: build.query<GaaRow[], string>({
      queryFn: (id) => fromService(() => gaaService.getRows(id)),
      providesTags: (_r, _e, id) => [{ type: "GaaUpload", id: `${id}-rows` }],
    }),
    getGaaColumns: build.query<GaaSourceColumn[], string>({
      queryFn: (id) => fromService(() => gaaService.getColumns(id)),
    }),
    getGaaImportResult: build.query<ImportGaaResponse, string>({
      queryFn: (id) => fromService(() => gaaService.getImportResult(id)),
      providesTags: (_r, _e, id) => [{ type: "GaaUpload", id: `${id}-result` }],
    }),
    uploadGaa: build.mutation<GaaUploadBatch, UploadGaaRequest>({
      queryFn: (arg) => fromService(() => gaaService.upload(arg)),
      invalidatesTags: [{ type: "GaaUpload", id: "LIST" }],
    }),
    validateGaa: build.mutation<GaaValidationSummary, string>({
      queryFn: (id) => fromService(() => gaaService.validate(id)),
      invalidatesTags: (_r, _e, id) => [
        { type: "GaaUpload", id },
        { type: "GaaUpload", id: `${id}-rows` },
        { type: "GaaUpload", id: "LIST" },
      ],
    }),
    importGaa: build.mutation<ImportGaaResponse, ImportGaaRequest>({
      queryFn: (arg) => fromService(() => gaaService.import(arg)),
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
      queryFn: (id) => fromService(() => gaaService.delete(id)),
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
