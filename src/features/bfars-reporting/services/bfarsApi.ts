import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { BfarsReportData, BfarsReportParams } from "../types";
import type { QproParams, QproReport } from "../qpro/types";

export const bfarsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getBfarsReport: build.query<BfarsReportData, BfarsReportParams>({
      query: ({ id, fiscalYear, quarter }) => ({ url: ENDPOINTS.bfars.report(id), params: { fiscalYear, quarter } }),
      providesTags: (_r, _e, { id }) => [{ type: "Bfars", id }],
    }),
  }),
});

export const { useGetBfarsReportQuery } = bfarsApi;

export const qproApi = api.injectEndpoints({
  endpoints: (build) => ({
    getQproReport: build.query<QproReport, QproParams>({
      query: (params) => ({ url: ENDPOINTS.bfars.qpro, params }),
      providesTags: [{ type: "Bfars", id: "bfars-1" }],
    }),
  }),
});

export const { useGetQproReportQuery, useLazyGetQproReportQuery } = qproApi;
