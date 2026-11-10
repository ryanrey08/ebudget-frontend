import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { GeneratedReport } from "@/features/reports/types";
import type { BfarsReportData, BfarsReportParams } from "@/features/bfars-reporting/types";
import type { QproParams, QproReport } from "@/features/bfars-reporting/qpro/types";
import type { SaaodbParams, SaaodbReport } from "@/features/bfars-reporting/saaodb/types";
import type { SaaodboeParams, SaaodboeReport } from "@/features/bfars-reporting/saaodboe/types";
import type { LasaParams, LasaReport } from "@/features/bfars-reporting/lasa/types";
import type { SodlbiaftParams, SodlbiaftReport } from "@/features/bfars-reporting/sodlbiaft/types";
import type { SabudbParams, SabudbReport } from "@/features/bfars-reporting/sabudb/types";
import type { SabudboeParams, SabudboeReport } from "@/features/bfars-reporting/sabudboe/types";
import type { AuoParams, AuoReport } from "@/features/bfars-reporting/auo/types";
import type { MrdParams, MrdReport } from "@/features/bfars-reporting/mrd/types";
import type { QrrorParams, QrrorReport } from "@/features/bfars-reporting/qrror/types";
import type { SabudbtrParams, SabudbtrReport } from "@/features/bfars-reporting/sabudbtr/types";

/**
 * BFARS 1–11. Each report has:
 *  - `getBFARSn(params)`: report data for the selected fiscal year / period and
 *    filters, including the filter options (`options`) the page shows. The
 *    preview, print and PDF/Excel/Word exports are built in the browser from
 *    this data by each report's document.ts, so their layouts and formulas
 *    stay exactly as implemented.
 *  - `generateBFARSn(payload)`: records a generated report (format, parameters,
 *    period) in the report history and returns the history entry.
 *  - `getGeneratedBFARSn()`: previously generated copies of the report.
 */

export type BfarsReportId =
  | "bfars-1" | "bfars-2" | "bfars-3" | "bfars-4" | "bfars-5" | "bfars-6"
  | "bfars-7" | "bfars-8" | "bfars-9" | "bfars-10" | "bfars-11";

/** Export formats offered by the BFARS generators. */
export type BfarsExportFormat = "pdf" | "excel" | "word" | "csv";

export interface GenerateBfarsRequest<P = Record<string, unknown>> {
  params: P;
  format: BfarsExportFormat | string;
  /** Generator options (layout, sections, grouping…), stored with the record. */
  options?: Record<string, unknown>;
}

/** The ENDPOINTS key of every report's data endpoint. */
export const BFARS_DATA_ENDPOINTS: Record<BfarsReportId, string> = {
  "bfars-1": ENDPOINTS.bfars.qpro,
  "bfars-2": ENDPOINTS.bfars.saaodb,
  "bfars-3": ENDPOINTS.bfars.saaodboe,
  "bfars-4": ENDPOINTS.bfars.lasa,
  "bfars-5": ENDPOINTS.bfars.sodlbiaft,
  "bfars-6": ENDPOINTS.bfars.sabudb,
  "bfars-7": ENDPOINTS.bfars.sabudboe,
  "bfars-8": ENDPOINTS.bfars.auo,
  "bfars-9": ENDPOINTS.bfars.mrd,
  "bfars-10": ENDPOINTS.bfars.qrror,
  "bfars-11": ENDPOINTS.bfars.sabudbtr,
};

const getData = <R, P extends object>(id: BfarsReportId) => (params: P) => apiClient.get<R>(BFARS_DATA_ENDPOINTS[id], params);
const generate = <P extends object>(id: BfarsReportId) => (payload: GenerateBfarsRequest<P>) =>
  apiClient.post<GeneratedReport>(ENDPOINTS.bfars.generate(id), payload);
const generated = (id: BfarsReportId) => () => apiClient.get<GeneratedReport[]>(ENDPOINTS.bfars.generated(id));

export const bfarsService = {
  /** Generic template-based report (fallback viewer). */
  getReport: ({ id, fiscalYear, quarter }: BfarsReportParams) => apiClient.get<BfarsReportData>(ENDPOINTS.bfars.report(id), { fiscalYear, quarter }),
  getData: <R = unknown>(id: BfarsReportId, params: object) => apiClient.get<R>(BFARS_DATA_ENDPOINTS[id], params),
  generate: (id: BfarsReportId, payload: GenerateBfarsRequest) => generate(id)(payload),
  getGenerated: (id: BfarsReportId) => generated(id)(),

  getBFARS1: getData<QproReport, QproParams>("bfars-1"),
  generateBFARS1: generate<QproParams>("bfars-1"),
  getGeneratedBFARS1: generated("bfars-1"),

  getBFARS2: getData<SaaodbReport, SaaodbParams>("bfars-2"),
  generateBFARS2: generate<SaaodbParams>("bfars-2"),
  getGeneratedBFARS2: generated("bfars-2"),

  getBFARS3: getData<SaaodboeReport, SaaodboeParams>("bfars-3"),
  generateBFARS3: generate<SaaodboeParams>("bfars-3"),
  getGeneratedBFARS3: generated("bfars-3"),

  getBFARS4: getData<LasaReport, LasaParams>("bfars-4"),
  generateBFARS4: generate<LasaParams>("bfars-4"),
  getGeneratedBFARS4: generated("bfars-4"),

  getBFARS5: getData<SodlbiaftReport, SodlbiaftParams>("bfars-5"),
  generateBFARS5: generate<SodlbiaftParams>("bfars-5"),
  getGeneratedBFARS5: generated("bfars-5"),

  getBFARS6: getData<SabudbReport, SabudbParams>("bfars-6"),
  generateBFARS6: generate<SabudbParams>("bfars-6"),
  getGeneratedBFARS6: generated("bfars-6"),

  getBFARS7: getData<SabudboeReport, SabudboeParams>("bfars-7"),
  generateBFARS7: generate<SabudboeParams>("bfars-7"),
  getGeneratedBFARS7: generated("bfars-7"),

  getBFARS8: getData<AuoReport, AuoParams>("bfars-8"),
  generateBFARS8: generate<AuoParams>("bfars-8"),
  getGeneratedBFARS8: generated("bfars-8"),

  getBFARS9: getData<MrdReport, MrdParams>("bfars-9"),
  generateBFARS9: generate<MrdParams>("bfars-9"),
  getGeneratedBFARS9: generated("bfars-9"),

  getBFARS10: getData<QrrorReport, QrrorParams>("bfars-10"),
  generateBFARS10: generate<QrrorParams>("bfars-10"),
  getGeneratedBFARS10: generated("bfars-10"),

  getBFARS11: getData<SabudbtrReport, SabudbtrParams>("bfars-11"),
  generateBFARS11: generate<SabudbtrParams>("bfars-11"),
  getGeneratedBFARS11: generated("bfars-11"),
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Human readable reporting period for a set of BFARS parameters. */
export function describeBfarsPeriod(params: Record<string, unknown>): string {
  const fy = params.fiscalYear ? `FY ${params.fiscalYear}` : "";
  if (typeof params.month === "number" && params.month >= 1 && params.month <= 12) {
    return `${MONTHS[params.month - 1]} ${params.fiscalYear ?? ""}`.trim();
  }
  if (typeof params.asOf === "string" && params.asOf) return `${fy} as of ${params.asOf}`.trim();
  if (typeof params.quarter === "string" && params.quarter) return `${fy} ${params.quarter}`.trim();
  return fy || "—";
}

/** Maps a generator's format value to the report history format. */
export function toHistoryFormat(format: string): GeneratedReport["format"] {
  const f = format.toLowerCase();
  if (f === "excel" || f === "xlsx" || f === "xls") return "XLSX";
  if (f === "word" || f === "doc" || f === "docx") return "DOCX";
  if (f === "csv") return "CSV";
  return "PDF";
}
