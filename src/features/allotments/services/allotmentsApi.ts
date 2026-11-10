import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { allotmentClassesService, allotmentsService, type AllotmentDocumentUpload } from "@/services/allotments.service";
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

/** RTK Query cache for allotments; requests are made by allotmentsService. */
export const allotmentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAllotments: build.query<Paginated<Allotment>, AllotmentListParams>({
      queryFn: (params) => fromService(() => allotmentsService.getAll(params)),
      providesTags: (result) => [
        { type: "Allotment", id: "LIST" },
        ...(result?.items.map((a) => ({ type: "Allotment" as const, id: a.id })) ?? []),
      ],
    }),
    getAllotmentSummary: build.query<AllotmentSummary, { fiscalYear: number }>({
      queryFn: (params) => fromService(() => allotmentsService.getSummary(params)),
      providesTags: [{ type: "Allotment", id: "SUMMARY" }],
    }),
    getAllotment: build.query<AllotmentDetail, string>({
      queryFn: (id) => fromService(() => allotmentsService.getById(id)),
      providesTags: (_r, _e, id) => [{ type: "Allotment", id }],
    }),
    getNextAllotmentNumber: build.query<{ allotmentNo: string }, { fiscalYear: number }>({
      queryFn: (params) => fromService(() => allotmentsService.getNextNumber(params)),
      providesTags: [{ type: "Allotment", id: "LIST" }],
    }),
    uploadAllotmentDocument: build.mutation<AllotmentDocument, AllotmentDocumentUpload>({
      queryFn: (arg) => fromService(() => allotmentsService.uploadDocument(arg)),
    }),
    attachAllotmentDocument: build.mutation<AllotmentDetail, { id: string; file: File }>({
      queryFn: (arg) => fromService(() => allotmentsService.attachDocument(arg)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Allotment", id }],
    }),
    createAllotment: build.mutation<Allotment, CreateAllotmentRequest>({
      queryFn: (body) => fromService(() => allotmentsService.create(body)),
      invalidatesTags: AFFECTED,
    }),
    allotmentWorkflow: build.mutation<AllotmentDetail, AllotmentWorkflowRequest>({
      queryFn: (arg) => fromService(() => allotmentsService.workflow(arg)),
      invalidatesTags: (_r, _e, { id, action }) =>
        action === "saveRemarks" ? [{ type: "Allotment", id }] : [{ type: "Allotment", id }, ...AFFECTED, "Notification"],
    }),
    getRegistryLookups: build.query<RegistryLookups, string>({
      queryFn: (code) => fromService(() => allotmentClassesService.getLookups(code)),
    }),
    createRegistryAllotment: build.mutation<Allotment, RegistryAllotmentInput>({
      queryFn: (body) => fromService(() => allotmentClassesService.create(body)),
      invalidatesTags: AFFECTED,
    }),
    updateRegistryAllotment: build.mutation<Allotment, RegistryAllotmentInput & { id: string }>({
      queryFn: (arg) => fromService(() => allotmentClassesService.update(arg)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Allotment", id }, ...AFFECTED],
    }),
    removeAllotmentDocument: build.mutation<AllotmentDetail, { id: string; docId: string }>({
      queryFn: (arg) => fromService(() => allotmentsService.removeDocument(arg)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Allotment", id }],
    }),
    deleteAllotment: build.mutation<MessageResponse, string>({
      queryFn: (id) => fromService(() => allotmentsService.delete(id)),
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
