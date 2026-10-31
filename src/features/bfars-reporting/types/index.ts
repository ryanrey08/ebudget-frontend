export type ReportCellType = "text" | "currency" | "percent" | "number" | "date";
export type ReportCellValue = string | number;
export type ReportRow = Record<string, ReportCellValue>;

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportCellType;
}

export interface ReportMetric {
  label: string;
  value: number;
  type: Exclude<ReportCellType, "text" | "date">;
}

export interface BfarsReportData {
  id: string;
  fiscalYear: number;
  period: string;
  agency: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: ReportRow;
  metrics: ReportMetric[];
  /** Optional chart: a category column plotted against numeric columns. */
  chart?: { categoryKey: string; seriesKeys: string[] };
  notes: string[];
}

export interface BfarsReportParams {
  id: string;
  fiscalYear: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
}
