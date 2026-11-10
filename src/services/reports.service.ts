import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { GenerateReportRequest, GeneratedReport, ReportCategory, ReportDefinition } from "@/features/reports/types";

export interface ReportListParams {
  category?: ReportCategory | "";
  search?: string;
}

/** Report catalog, generation and history (Reports page). */
export const reportsService = {
  getAll: (params: ReportListParams) => apiClient.get<ReportDefinition[]>(ENDPOINTS.reports.list, params),
  getHistory: () => apiClient.get<GeneratedReport[]>(ENDPOINTS.reports.history),
  generate: (payload: GenerateReportRequest) => apiClient.post<GeneratedReport>(ENDPOINTS.reports.generate, payload),
  /** Downloads a generated report file (real backend; the mock returns a summary file). */
  download: (report: Pick<GeneratedReport, "id" | "reportName" | "format">) =>
    apiClient.download(ENDPOINTS.reports.download(report.id), {
      fileName: `${report.reportName.replace(/[^\w.-]+/g, "_")}.${report.format.toLowerCase()}`,
    }),
};
