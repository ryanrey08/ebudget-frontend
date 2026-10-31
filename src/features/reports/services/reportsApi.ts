import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { GenerateReportRequest, GeneratedReport, ReportCategory, ReportDefinition } from "../types";

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getReports: build.query<ReportDefinition[], { category?: ReportCategory | ""; search?: string }>({
      query: (params) => ({ url: ENDPOINTS.reports.list, params }),
      providesTags: [{ type: "Report", id: "LIST" }],
    }),
    getReportHistory: build.query<GeneratedReport[], void>({
      query: () => ENDPOINTS.reports.history,
      providesTags: [{ type: "Report", id: "HISTORY" }],
    }),
    generateReport: build.mutation<GeneratedReport, GenerateReportRequest>({
      query: (body) => ({ url: ENDPOINTS.reports.generate, method: "POST", body }),
      invalidatesTags: [
        { type: "Report", id: "HISTORY" },
        { type: "Report", id: "LIST" },
      ],
    }),
  }),
});

export const { useGetReportsQuery, useGetReportHistoryQuery, useGenerateReportMutation } = reportsApi;
