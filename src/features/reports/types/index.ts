export const REPORT_CATEGORIES = ["Budget", "Allotment", "Obligation", "BFARS", "Disbursement"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface ReportDefinition {
  id: string;
  name: string;
  code: string;
  category: ReportCategory;
  description: string;
  frequency: "Monthly" | "Quarterly" | "Annual" | "On demand";
  /** In-app page that renders the report, when one exists. */
  href?: string;
  lastGeneratedAt?: string;
}

export interface GeneratedReport {
  id: string;
  reportId: string;
  reportName: string;
  period: string;
  format: "PDF" | "XLSX" | "DOCX" | "CSV";
  /** Parameters used to generate the report (BFARS generators). */
  parameters?: Record<string, unknown>;
  generatedAt: string;
  generatedBy: string;
  status: "Ready" | "Processing";
}

export interface GenerateReportRequest {
  reportId: string;
  period: string;
  format: GeneratedReport["format"];
}
