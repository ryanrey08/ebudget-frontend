import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { obligationsService } from "@/services/obligations.service";
import type { MessageResponse, Paginated } from "@/types/api";
import type {
  Obligation,
  ObligationDetail,
  ObligationDocument,
  ObligationInput,
  ObligationListParams,
  ObligationLookups,
  ObligationSummary,
  ObligationWorkflowRequest,
} from "../types";

/** Everything that depends on obligation amounts or statuses. */
const AFFECTED = [
  { type: "Obligation" as const, id: "LIST" },
  { type: "Obligation" as const, id: "SUMMARY" },
  { type: "Allotment" as const, id: "LIST" },
  { type: "Allotment" as const, id: "SUMMARY" },
  "AllotmentClass" as const,
  "Dashboard" as const,
];

/** RTK Query cache for obligations; requests are made by obligationsService. */
export const obligationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getObligations: build.query<Paginated<Obligation>, ObligationListParams>({
      queryFn: (params) => fromService(() => obligationsService.getAll(params)),
      providesTags: (result) => [
        { type: "Obligation", id: "LIST" },
        ...(result?.items.map((o) => ({ type: "Obligation" as const, id: o.id })) ?? []),
      ],
    }),
    getObligationSummary: build.query<ObligationSummary, { fiscalYear: number }>({
      queryFn: (params) => fromService(() => obligationsService.getSummary(params)),
      providesTags: [{ type: "Obligation", id: "SUMMARY" }],
    }),
    getObligationLookups: build.query<ObligationLookups, void>({
      queryFn: () => fromService(() => obligationsService.getLookups()),
      providesTags: [{ type: "Obligation", id: "LOOKUPS" }],
    }),
    getNextObligationNumber: build.query<{ referenceNo: string }, { fiscalYear: number }>({
      queryFn: (params) => fromService(() => obligationsService.getNextNumber(params)),
      providesTags: [{ type: "Obligation", id: "LIST" }],
    }),
    getObligation: build.query<ObligationDetail, string>({
      queryFn: (id) => fromService(() => obligationsService.getById(id)),
      providesTags: (_r, _e, id) => [{ type: "Obligation", id }],
    }),
    uploadObligationDocument: build.mutation<ObligationDocument, File>({
      queryFn: (file) => fromService(() => obligationsService.uploadDocument(file)),
    }),
    createObligation: build.mutation<Obligation, ObligationInput>({
      queryFn: (body) => fromService(() => obligationsService.create(body)),
      invalidatesTags: [...AFFECTED, { type: "Obligation", id: "LOOKUPS" }],
    }),
    updateObligation: build.mutation<Obligation, ObligationInput & { id: string }>({
      queryFn: (arg) => fromService(() => obligationsService.update(arg)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Obligation", id }, ...AFFECTED],
    }),
    obligationWorkflow: build.mutation<ObligationDetail, ObligationWorkflowRequest>({
      queryFn: (arg) => fromService(() => obligationsService.workflow(arg)),
      invalidatesTags: (_r, _e, { id, action }) =>
        action === "saveRemarks" ? [{ type: "Obligation", id }] : [{ type: "Obligation", id }, ...AFFECTED],
    }),
    deleteObligation: build.mutation<MessageResponse, string>({
      queryFn: (id) => fromService(() => obligationsService.delete(id)),
      invalidatesTags: AFFECTED,
    }),
  }),
});

export const {
  useGetObligationsQuery,
  useGetObligationSummaryQuery,
  useGetObligationLookupsQuery,
  useGetNextObligationNumberQuery,
  useGetObligationQuery,
  useUploadObligationDocumentMutation,
  useCreateObligationMutation,
  useUpdateObligationMutation,
  useObligationWorkflowMutation,
  useDeleteObligationMutation,
} = obligationsApi;
