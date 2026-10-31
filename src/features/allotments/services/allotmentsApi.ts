import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse, Paginated } from "@/types/api";
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
} from "../types";

/** Everything that depends on allotment amounts or releases. */
const AFFECTED = [
  { type: "Allotment" as const, id: "LIST" },
  { type: "Allotment" as const, id: "SUMMARY" },
  { type: "Appropriation" as const, id: "LIST" },
  { type: "Appropriation" as const, id: "SUMMARY" },
  "AllotmentClass" as const,
  "Dashboard" as const,
];

export const allotmentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAllotments: build.query<Paginated<Allotment>, AllotmentListParams>({
      query: (params) => ({ url: ENDPOINTS.allotments.list, params }),
      providesTags: (result) => [
        { type: "Allotment", id: "LIST" },
        ...(result?.items.map((a) => ({ type: "Allotment" as const, id: a.id })) ?? []),
      ],
    }),
    getAllotmentSummary: build.query<AllotmentSummary, { fiscalYear: number }>({
      query: (params) => ({ url: ENDPOINTS.allotments.summary, params }),
      providesTags: [{ type: "Allotment", id: "SUMMARY" }],
    }),
    getAllotment: build.query<AllotmentDetail, string>({
      query: (id) => ENDPOINTS.allotments.detail(id),
      providesTags: (_r, _e, id) => [{ type: "Allotment", id }],
    }),
    getNextAllotmentNumber: build.query<{ allotmentNo: string }, { fiscalYear: number }>({
      query: (params) => ({ url: ENDPOINTS.allotments.nextNumber, params }),
      providesTags: [{ type: "Allotment", id: "LIST" }],
    }),
    uploadAllotmentDocument: build.mutation<AllotmentDocument, File | { file: File; category?: string; description?: string }>({
      query: (arg) => {
        const { file, category, description } = arg instanceof File ? { file: arg, category: undefined, description: undefined } : arg;
        const body = new FormData();
        body.append("file", file);
        if (category) body.append("category", category);
        if (description) body.append("description", description);
        return { url: ENDPOINTS.allotments.documents, method: "POST", body };
      },
    }),
    attachAllotmentDocument: build.mutation<AllotmentDetail, { id: string; file: File }>({
      query: ({ id, file }) => {
        const body = new FormData();
        body.append("file", file);
        return { url: ENDPOINTS.allotments.attachDocument(id), method: "POST", body };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: "Allotment", id }],
    }),
    createAllotment: build.mutation<Allotment, CreateAllotmentRequest>({
      query: (body) => ({ url: ENDPOINTS.allotments.list, method: "POST", body }),
      invalidatesTags: AFFECTED,
    }),
    allotmentWorkflow: build.mutation<AllotmentDetail, AllotmentWorkflowRequest>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.allotments.workflow(id), method: "POST", body }),
      invalidatesTags: (_r, _e, { id, action }) =>
        action === "saveRemarks" ? [{ type: "Allotment", id }] : [{ type: "Allotment", id }, ...AFFECTED, "Notification"],
    }),
    getRegistryLookups: build.query<RegistryLookups, string>({
      query: (code) => ENDPOINTS.allotmentClasses.lookups(code),
    }),
    createRegistryAllotment: build.mutation<Allotment, RegistryAllotmentInput>({
      query: (body) => ({ url: ENDPOINTS.allotments.registry, method: "POST", body }),
      invalidatesTags: AFFECTED,
    }),
    updateRegistryAllotment: build.mutation<Allotment, RegistryAllotmentInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.allotments.updateRegistry(id), method: "PUT", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Allotment", id }, ...AFFECTED],
    }),
    removeAllotmentDocument: build.mutation<AllotmentDetail, { id: string; docId: string }>({
      query: ({ id, docId }) => ({ url: ENDPOINTS.allotments.document(id, docId), method: "DELETE" }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Allotment", id }],
    }),
    deleteAllotment: build.mutation<MessageResponse, string>({
      query: (id) => ({ url: ENDPOINTS.allotments.detail(id), method: "DELETE" }),
      invalidatesTags: AFFECTED,
    }),
  }),
});

export const {
  useGetAllotmentsQuery,
  useGetAllotmentSummaryQuery,
  useGetAllotmentQuery,
  useGetNextAllotmentNumberQuery,
  useUploadAllotmentDocumentMutation,
  useAttachAllotmentDocumentMutation,
  useCreateAllotmentMutation,
  useAllotmentWorkflowMutation,
  useDeleteAllotmentMutation,
  useGetRegistryLookupsQuery,
  useCreateRegistryAllotmentMutation,
  useUpdateRegistryAllotmentMutation,
  useRemoveAllotmentDocumentMutation,
} = allotmentsApi;
