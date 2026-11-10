import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { appropriationsService } from "@/services/appropriations.service";
import type { MessageResponse, Paginated } from "@/types/api";
import type {
  Appropriation,
  AppropriationDocument,
  AppropriationListParams,
  AppropriationLookups,
  AppropriationSummary,
  CreateAppropriationRequest,
} from "../types";

/** RTK Query cache for appropriations; requests are made by appropriationsService. */
export const appropriationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAppropriations: build.query<Paginated<Appropriation>, AppropriationListParams>({
      queryFn: (params) => fromService(() => appropriationsService.getAll(params)),
      providesTags: (result) => [
        { type: "Appropriation", id: "LIST" },
        ...(result?.items.map((a) => ({ type: "Appropriation" as const, id: a.id })) ?? []),
      ],
    }),
    getAppropriationSummary: build.query<AppropriationSummary, { fiscalYear: number }>({
      queryFn: (params) => fromService(() => appropriationsService.getSummary(params)),
      providesTags: [{ type: "Appropriation", id: "SUMMARY" }],
    }),
    getAppropriationLookups: build.query<AppropriationLookups, void>({
      queryFn: () => fromService(() => appropriationsService.getLookups()),
      providesTags: [{ type: "Appropriation", id: "LOOKUPS" }],
    }),
    uploadAppropriationDocument: build.mutation<AppropriationDocument, File>({
      queryFn: (file) => fromService(() => appropriationsService.uploadDocument(file)),
    }),
    createAppropriation: build.mutation<Appropriation, CreateAppropriationRequest>({
      queryFn: (body) => fromService(() => appropriationsService.create(body)),
      invalidatesTags: [
        { type: "Appropriation", id: "LIST" },
        { type: "Appropriation", id: "SUMMARY" },
        { type: "Appropriation", id: "LOOKUPS" },
        "Dashboard",
      ],
    }),
    deleteAppropriation: build.mutation<MessageResponse, string>({
      queryFn: (id) => fromService(() => appropriationsService.delete(id)),
      invalidatesTags: [{ type: "Appropriation", id: "LIST" }, { type: "Appropriation", id: "SUMMARY" }, "Dashboard"],
    }),
  }),
});

export const {
  useGetAppropriationsQuery,
  useCreateAppropriationMutation,
  useGetAppropriationSummaryQuery,
  useGetAppropriationLookupsQuery,
  useUploadAppropriationDocumentMutation,
  useDeleteAppropriationMutation,
} = appropriationsApi;
