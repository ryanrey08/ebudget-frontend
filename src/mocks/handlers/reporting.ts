import { ENDPOINTS } from "@/lib/api/endpoints";
import { getBfarsReport } from "@/lib/constants/bfars";
import { AGENCIES } from "@/config/site";
import type { BfarsReportData, ReportRow } from "@/features/bfars-reporting/types";
import type { GenerateReportRequest, GeneratedReport, ReportDefinition } from "@/features/reports/types";
import type { Quarter, QproReport, QproStatus } from "@/features/bfars-reporting/qpro/types";
import { BFARS_TEMPLATES } from "../data/bfars";
import { FUND_SOURCES } from "../data/lookups";
import { buildQproRows } from "../data/qpro";
import { REPORT_CATALOG } from "../data/reports";
import { db, getMockSessionUserName } from "../services/db";
import { MockHttpError, matchesSearch, num, route, str } from "../services/http";

const QUARTER_FACTOR: Record<string, number> = { Q1: 1, Q2: 1.85, Q3: 2.6, Q4: 3.4 };
const YEAR_FACTOR: Record<number, number> = { 2026: 1, 2025: 0.92, 2024: 0.85 };
const QUARTER_LABEL: Record<string, string> = {
  Q1: "1st Quarter (January–March)",
  Q2: "2nd Quarter (April–June)",
  Q3: "3rd Quarter (July–September)",
  Q4: "4th Quarter (October–December)",
};
const QUARTER_END_MONTH: Record<string, string> = { Q1: "March", Q2: "June", Q3: "September", Q4: "December" };

const QPRO_ROWS = buildQproRows();
const QPRO_STATUSES: QproStatus[] = ["On Track", "Needs Attention", "At Risk"];
const QUARTER_END: Record<string, string> = { Q1: "03-31", Q2: "06-30", Q3: "09-30", Q4: "12-31" };

export const reportingHandlers = [
  // BFARS 1 (QPRO): sample activity rows, with amounts scaled per quarter and year like the other BFARS samples.
  route("GET", ENDPOINTS.bfars.qpro, ({ query }): QproReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = (str(query.quarter) || "Q1") as Quarter;
    if (!QUARTER_LABEL[quarter]) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    const factor = (QUARTER_FACTOR[quarter] ?? 1) * (YEAR_FACTOR[fiscalYear] ?? 1);
    const f = (k: string) => str(query[k]);
    const matches = (r: (typeof QPRO_ROWS)[number]) =>
      (!f("department") || r.department === f("department")) &&
      (!f("uacsMajor") || r.uacsMajor === f("uacsMajor")) &&
      (!f("allotmentClass") || r.allotmentClass === f("allotmentClass")) &&
      (!f("pap") || r.pap === f("pap")) &&
      (!f("fundSource") || r.fundSource === f("fundSource")) &&
      (!f("status") || r.status === f("status"));
    const inYear = QPRO_ROWS.filter((r) => r.startYear <= fiscalYear);
    const scaleAmount = (v: number) => Math.round((v * factor) / 1000) * 1000;
    const rows = inYear.filter(matches).map(({ startYear: _startYear, ...r }) => ({
      ...r,
      allotment: scaleAmount(r.allotment),
      obligations: Math.min(scaleAmount(r.obligations), scaleAmount(r.allotment)),
      disbursements: Math.min(scaleAmount(r.disbursements), scaleAmount(r.obligations), scaleAmount(r.allotment)),
    }));
    const prevYear = fiscalYear - 1;
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      asOf: `${fiscalYear}-${QUARTER_END[quarter]}`,
      agency: AGENCIES[0].name,
      rows,
      previousCount: prevYear in YEAR_FACTOR ? QPRO_ROWS.filter((r) => r.startYear <= prevYear).filter(matches).length : null,
      options: {
        departments: [...new Set(inYear.map((r) => r.department))].sort(),
        uacsMajors: [...new Set(inYear.map((r) => r.uacsMajor))].sort(),
        paps: [...new Map(inYear.map((r) => [r.pap, { code: r.pap, title: r.papTitle }])).values()],
        fundSources: FUND_SOURCES.filter((fs) => inYear.some((r) => r.fundSource === fs.code)),
        statuses: QPRO_STATUSES,
      },
    };
  }),

  route("GET", "/bfars/:id", ({ params, query }): BfarsReportData => {
    const meta = getBfarsReport(params.id);
    const template = BFARS_TEMPLATES[params.id];
    if (!meta || !template) throw new MockHttpError(404, "Report not found.");
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = str(query.quarter) || "Q1";
    const factor = (QUARTER_FACTOR[quarter] ?? 1) * (YEAR_FACTOR[fiscalYear] ?? 1);
    const amountKeys = new Set(template.columns.filter((c) => c.type === "currency").map((c) => c.key));
    const scale = (row: ReportRow): ReportRow =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          typeof v === "number" && amountKeys.has(k)
            ? Math.round(v * factor)
            : typeof v === "string"
              ? v.replace(/2026/g, String(fiscalYear))
              : v,
        ]),
      );
    return {
      ...template,
      id: meta.id,
      fiscalYear,
      agency: AGENCIES[0].name,
      period:
        meta.code === "MRD"
          ? `${QUARTER_END_MONTH[quarter]} ${fiscalYear}`
          : `FY ${fiscalYear} • ${QUARTER_LABEL[quarter] ?? quarter}`,
      rows: template.rows.map(scale),
      totals: template.totals ? scale(template.totals) : undefined,
      metrics: template.metrics.map((m) => (m.type === "currency" ? { ...m, value: Math.round(m.value * factor) } : m)),
    };
  }),

  route("GET", ENDPOINTS.reports.list, ({ query }): ReportDefinition[] => {
    const search = str(query.search);
    return REPORT_CATALOG.filter((r) => !query.category || r.category === query.category)
      .filter((r) => matchesSearch(search, r.name, r.code, r.description))
      .map((r) => {
        const latest = db.reportHistory.find((h) => h.reportId === r.id);
        return latest ? { ...r, lastGeneratedAt: latest.generatedAt } : r;
      });
  }),

  route("GET", ENDPOINTS.reports.history, (): GeneratedReport[] =>
    [...db.reportHistory].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
  ),

  route<GenerateReportRequest>("POST", ENDPOINTS.reports.generate, ({ body }): GeneratedReport => {
    const definition = REPORT_CATALOG.find((r) => r.id === body.reportId);
    if (!definition) throw new MockHttpError(404, "Report not found.");
    const record: GeneratedReport = {
      id: `gen-${String(db.reportHistory.length + 1).padStart(4, "0")}`,
      reportId: definition.id,
      reportName: definition.name,
      period: body.period,
      format: body.format,
      generatedAt: new Date().toISOString(),
      generatedBy: getMockSessionUserName(),
      status: "Ready",
    };
    db.reportHistory.unshift(record);
    return record;
  }),

  route("GET", ENDPOINTS.notifications.list, () =>
    [...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  ),

  route("PATCH", "/notifications/:id/read", ({ params }) => {
    const item = db.notifications.find((n) => n.id === params.id);
    if (!item) throw new MockHttpError(404, "Notification not found.");
    item.read = true;
    return { message: "Marked as read." };
  }),

  route("POST", ENDPOINTS.notifications.readAll, () => {
    db.notifications.forEach((n) => (n.read = true));
    return { message: "All notifications marked as read." };
  }),
];
