import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
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

export const obligationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getObligations: build.query<Paginated<Obligation>, ObligationListParams>({
      query: (params) => ({ url: ENDPOINTS.obligations.list, params }),
      providesTags: (result) => [
        { type: "Obligation", id: "LIST" },
        ...(result?.items.map((o) => ({ type: "Obligation" as const, id: o.id })) ?? []),
      ],
    }),
    getObligationSummary: build.query<ObligationSummary, { fiscalYear: number }>({
      query: (params) => ({ url: ENDPOINTS.obligations.summary, params }),
      providesTags: [{ type: "Obligation", id: "SUMMARY" }],
    }),
    getObligationLookups: build.query<ObligationLookups, void>({
      query: () => ENDPOINTS.obligations.lookups,
      providesTags: [{ type: "Obligation", id: "LOOKUPS" }],
    }),
    getNextObligationNumber: build.query<{ referenceNo: string }, { fiscalYear: number }>({
      query: (params) => ({ url: ENDPOINTS.obligations.nextNumber, params }),
      providesTags: [{ type: "Obligation", id: "LIST" }],
    }),
    getObligation: build.query<ObligationDetail, string>({
      query: (id) => ENDPOINTS.obligations.detail(id),
      providesTags: (_r, _e, id) => [{ type: "Obligation", id }],
    }),
    uploadObligationDocument: build.mutation<ObligationDocument, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { url: ENDPOINTS.obligations.documents, method: "POST", body };
      },
    }),
    createObligation: build.mutation<Obligation, ObligationInput>({
      query: (body) => ({ url: ENDPOINTS.obligations.list, method: "POST", body }),
      invalidatesTags: [...AFFECTED, { type: "Obligation", id: "LOOKUPS" }],
    }),
    updateObligation: build.mutation<Obligation, ObligationInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.obligations.detail(id), method: "PUT", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Obligation", id }, ...AFFECTED],
    }),
    obligationWorkflow: build.mutation<ObligationDetail, ObligationWorkflowRequest>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.obligations.workflow(id), method: "POST", body }),
      invalidatesTags: (_r, _e, { id, action }) =>
        action === "saveRemarks" ? [{ type: "Obligation", id }] : [{ type: "Obligation", id }, ...AFFECTED],
    }),
    deleteObligation: build.mutation<MessageResponse, string>({
      query: (id) => ({ url: ENDPOINTS.obligations.detail(id), method: "DELETE" }),
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
