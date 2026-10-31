import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse, Paginated } from "@/types/api";
import type {
  Appropriation,
  AppropriationDocument,
  AppropriationListParams,
  AppropriationLookups,
  AppropriationSummary,
  CreateAppropriationRequest,
} from "../types";

export const appropriationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAppropriations: build.query<Paginated<Appropriation>, AppropriationListParams>({
      query: (params) => ({ url: ENDPOINTS.appropriations.list, params }),
      providesTags: (result) => [
        { type: "Appropriation", id: "LIST" },
        ...(result?.items.map((a) => ({ type: "Appropriation" as const, id: a.id })) ?? []),
      ],
    }),
    getAppropriationSummary: build.query<AppropriationSummary, { fiscalYear: number }>({
      query: (params) => ({ url: ENDPOINTS.appropriations.summary, params }),
      providesTags: [{ type: "Appropriation", id: "SUMMARY" }],
    }),
    getAppropriationLookups: build.query<AppropriationLookups, void>({
      query: () => ENDPOINTS.appropriations.lookups,
      providesTags: [{ type: "Appropriation", id: "LOOKUPS" }],
    }),
    uploadAppropriationDocument: build.mutation<AppropriationDocument, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { url: ENDPOINTS.appropriations.documents, method: "POST", body };
      },
    }),
    createAppropriation: build.mutation<Appropriation, CreateAppropriationRequest>({
      query: (body) => ({ url: ENDPOINTS.appropriations.list, method: "POST", body }),
      invalidatesTags: [
        { type: "Appropriation", id: "LIST" },
        { type: "Appropriation", id: "SUMMARY" },
        { type: "Appropriation", id: "LOOKUPS" },
        "Dashboard",
      ],
    }),
    deleteAppropriation: build.mutation<MessageResponse, string>({
      query: (id) => ({ url: ENDPOINTS.appropriations.detail(id), method: "DELETE" }),
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
