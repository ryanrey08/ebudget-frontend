import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { reportsService, type ReportListParams } from "@/services/reports.service";
import type { GenerateReportRequest, GeneratedReport, ReportDefinition } from "../types";

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getReports: build.query<ReportDefinition[], ReportListParams>({
      queryFn: (params) => fromService(() => reportsService.getAll(params)),
      providesTags: [{ type: "Report", id: "LIST" }],
    }),
    getReportHistory: build.query<GeneratedReport[], void>({
      queryFn: () => fromService(() => reportsService.getHistory()),
      providesTags: [{ type: "Report", id: "HISTORY" }],
    }),
    generateReport: build.mutation<GeneratedReport, GenerateReportRequest>({
      queryFn: (body) => fromService(() => reportsService.generate(body)),
      invalidatesTags: [
        { type: "Report", id: "HISTORY" },
        { type: "Report", id: "LIST" },
      ],
    }),
  }),
});

export const { useGetReportsQuery, useGetReportHistoryQuery, useGenerateReportMutation } = reportsApi;
