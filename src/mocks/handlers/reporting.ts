import { ENDPOINTS } from "@/lib/api/endpoints";
import { getBfarsReport } from "@/lib/constants/bfars";
import { AGENCIES } from "@/config/site";
import type { BfarsReportData, ReportRow } from "@/features/bfars-reporting/types";
import type { GenerateReportRequest, GeneratedReport, ReportDefinition } from "@/features/reports/types";
import type { Quarter, QproReport, QproStatus } from "@/features/bfars-reporting/qpro/types";
import type { SaaodbReport, SaaodbRow } from "@/features/bfars-reporting/saaodb/types";
import type { SaaodboeReport, SaaodboeRow } from "@/features/bfars-reporting/saaodboe/types";
import { OBJECT_CLASSES } from "@/features/bfars-reporting/saaodboe/document";
import type { LasaReport, LasaRow } from "@/features/bfars-reporting/lasa/types";
import type { SodlbiaftReport, SodlbiaftRow } from "@/features/bfars-reporting/sodlbiaft/types";
import type { SabudbReport, SabudbRow } from "@/features/bfars-reporting/sabudb/types";
import type { SabudboeReport, SabudboeRow } from "@/features/bfars-reporting/sabudboe/types";
import type { AuoReport, AuoRow } from "@/features/bfars-reporting/auo/types";
import type { MrdReport, MrdRow } from "@/features/bfars-reporting/mrd/types";
import type { QrrorReport, QrrorRow } from "@/features/bfars-reporting/qrror/types";
import type { SabudbtrReport, SabudbtrRow } from "@/features/bfars-reporting/sabudbtr/types";
import { BFARS_TEMPLATES } from "../data/bfars";
import { AUO_FY2026_ROWS } from "../data/auo";
import { MRD_FY2026_ROWS } from "../data/mrd";
import { QRROR_ACCOUNTS, QRROR_Q1_ROWS } from "../data/qrror";
import { SABUDBTR_FUNDS, SABUDBTR_LATER_MONTH_FACTOR } from "../data/sabudbtr";
import { LASA_APPROPRIATIONS, LASA_Q1_ROWS, LASA_UACS_LABELS } from "../data/lasa";
import { SABUDB_LINES } from "../data/sabudb";
import { SABUDBOE_LINES, SABUDBOE_OFFICE_PAP } from "../data/sabudboe";
import { SODLBIAFT_AGENCIES, SODLBIAFT_PROGRAMS, SODLBIAFT_Q1_ROWS } from "../data/sodlbiaft";
import { FUND_SOURCES } from "../data/lookups";
import { buildQproRows } from "../data/qpro";
import { SAAODB_LINES, UACS_MAJOR_LABELS } from "../data/saaodb";
import { SAAODBOE_LINES, SAAODBOE_REMARKS, SAAODBOE_SPLITS } from "../data/saaodboe";
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

// Cumulative growth after Q1 for the SAAODB sample (appropriations are annual and do not change by quarter).
const SAAODB_GROWTH: Record<string, { allotments: number; obligations: number; disbursements: number }> = {
  Q1: { allotments: 1, obligations: 1, disbursements: 1 },
  Q2: { allotments: 1.08, obligations: 1.18, disbursements: 1.3 },
  Q3: { allotments: 1.14, obligations: 1.32, disbursements: 1.55 },
  Q4: { allotments: 1.19, obligations: 1.45, disbursements: 1.75 },
};
const SIGNATORY_ROLES = [
  { role: "Prepared by", userRole: "budget_officer" },
  { role: "Reviewed by", userRole: "accountant" },
  { role: "Certified Correct", userRole: "head_of_agency" },
] as const;

function signatories() {
  return SIGNATORY_ROLES.map(({ role, userRole }) => {
    const u = db.users.find((x) => x.user.role === userRole)?.user;
    return { role, name: u ? `${u.firstName} ${u.lastName}` : "", position: u?.position ?? "" };
  });
}

// BFARS 4 (LASA): the Q1 sample records; later quarters reuse them as that quarter's issuances (dates shifted, amounts scaled).
const LASA_QUARTER_FACTOR: Record<string, number> = { Q1: 1, Q2: 0.9, Q3: 0.8, Q4: 0.6 };

function lasaRows(fiscalYear: number, quarter: Quarter): LasaRow[] {
  const qi = Number(quarter.slice(1)) - 1;
  const factor = LASA_QUARTER_FACTOR[quarter] * YEAR_FACTOR[fiscalYear];
  const round = (v: number) => Math.round((v * factor) / 1000) * 1000;
  return LASA_Q1_ROWS.map((r, i) => {
    const month = Number(r.date.slice(5, 7)) + qi * 3;
    return {
      ...r,
      allotmentNo: `ALT-${fiscalYear}-${String(qi * LASA_Q1_ROWS.length + i + 1).padStart(3, "0")}`,
      date: `${fiscalYear}-${String(month).padStart(2, "0")}-${r.date.slice(8)}`,
      allotmentAmount: round(r.allotmentAmount),
      subAllotmentAmount: round(r.subAllotmentAmount),
      releasedAmount: round(r.releasedAmount),
    };
  });
}

// BFARS 5 (SODLBIAFT): transfers are received in Q1; later quarters are cumulative, so utilization grows (never past the previous column).
const SODLBIAFT_GROWTH: Record<string, number> = { Q1: 1, Q2: 1.12, Q3: 1.22, Q4: 1.3 };

function sodlbiaftRows(fiscalYear: number, quarter: Quarter): SodlbiaftRow[] {
  const year = YEAR_FACTOR[fiscalYear];
  const g = SODLBIAFT_GROWTH[quarter];
  const round = (v: number) => Math.round(v / 1000) * 1000;
  return SODLBIAFT_Q1_ROWS.map((r) => {
    const fundsReceived = round(r.fundsReceived * year);
    const obligations = Math.min(round(r.obligations * year * g), fundsReceived);
    const disbursements = Math.min(round(r.disbursements * year * g), obligations);
    const liquidations = Math.min(round(r.liquidations * year * g), disbursements);
    return {
      ...r,
      referenceNo: r.referenceNo.replace("2026", String(fiscalYear)),
      dateReceived: `${fiscalYear}${r.dateReceived.slice(4)}`,
      fundsReceived,
      obligations,
      disbursements,
      liquidations,
    };
  });
}

// BFARS 6 (SABUDB): mockup lines scaled to the office/allotment-class share (same split as BFARS 3) and quarter.
// The approved budget is annual; allotments, obligations and disbursements are cumulative by quarter.
function sabudbRows(fiscalYear: number, quarter: Quarter, department: string, allotmentClass: string, uacsMajor: string): SabudbRow[] {
  const year = YEAR_FACTOR[fiscalYear];
  const g = SAAODB_GROWTH[quarter];
  const round = (v: number) => Math.round(v / 1000) * 1000;
  return SABUDB_LINES.filter((l) => !uacsMajor || l.uacsCode.startsWith(uacsMajor)).flatMap((l) => {
    const split = SAAODBOE_SPLITS[l.objectClass];
    const office = department ? (split.offices.find(([o]) => o === department)?.[1] ?? 0) : 1;
    const cls = allotmentClass ? (split.classes.find(([c]) => c === allotmentClass)?.[1] ?? 0) : 1;
    const share = office * cls;
    if (!share) return [];
    const gaaOriginal = round(l.gaaOriginal * year * share);
    const supplemental = round(l.supplemental * year * share);
    const allotments = Math.min(round(l.allotments * year * g.allotments * share), gaaOriginal + supplemental);
    const obligations = Math.min(round(l.obligations * year * g.obligations * share), allotments);
    const disbursements = Math.min(round(l.disbursements * year * g.disbursements * share), obligations);
    return [{ ...l, gaaOriginal, supplemental, allotments, obligations, disbursements }];
  });
}

// BFARS 7 (SABUDBOE): mockup lines split per office and allotment class (same split as BFARS 3) and scaled by quarter,
// rounded to centavos so the unfiltered Q1 totals equal the workbook. The approved budget is annual; the rest is cumulative.
function sabudboeRows(fiscalYear: number, quarter: Quarter, department: string, allotmentClass: string, uacsMajor: string): SabudboeRow[] {
  const year = YEAR_FACTOR[fiscalYear];
  const g = SAAODB_GROWTH[quarter];
  const round = (v: number) => Math.round(v * 100) / 100;
  return SABUDBOE_LINES.filter((l) => !uacsMajor || l.uacsCode.startsWith(uacsMajor)).flatMap((l) => {
    const split = SAAODBOE_SPLITS[l.objectClass];
    return split.offices
      .filter(([o]) => !department || o === department)
      .flatMap(([office, officeShare]) =>
        split.classes
          .filter(([c]) => !allotmentClass || c === allotmentClass)
          .map(([cls, classShare]) => {
            const share = year * officeShare * classShare;
            const gaaOriginal = round(l.gaaOriginal * share);
            const supplemental = round(l.supplemental * share);
            const allotments = Math.min(round(l.allotments * g.allotments * share), gaaOriginal + supplemental);
            const obligations = Math.min(round(l.obligations * g.obligations * share), allotments);
            const disbursements = Math.min(round(l.disbursements * g.disbursements * share), obligations);
            return { ...l, office, allotmentClass: cls, mfoPap: SABUDBOE_OFFICE_PAP[office] ?? office, gaaOriginal, supplemental, allotments, obligations, disbursements };
          }),
      );
  });
}

// BFARS 8 (Aging of Unpaid Obligations): the FY 2026 sample moved to the selected year (amounts scaled).
// Obligations dated after the as-of date are left out; no payments are recorded, so later dates age the same lines.
function auoRows(fiscalYear: number): AuoRow[] {
  const shift = (iso: string) => `${Number(iso.slice(0, 4)) + fiscalYear - 2026}${iso.slice(4)}`;
  return AUO_FY2026_ROWS.map((r) => ({
    ...r,
    referenceNo: r.referenceNo.replace("2026", String(fiscalYear)),
    dateObligated: shift(r.dateObligated),
    dueDate: shift(r.dueDate),
    amount: Math.round((r.amount * YEAR_FACTOR[fiscalYear]) / 1000) * 1000,
  }));
}

// BFARS 9 (Monthly Report of Disbursement): the FY 2026 sample moved to the selected year (amounts scaled).
function mrdRows(fiscalYear: number): MrdRow[] {
  return MRD_FY2026_ROWS.map((r) => ({
    ...r,
    referenceNo: r.referenceNo.replace("2026", String(fiscalYear)),
    date: `${fiscalYear}${r.date.slice(4)}`,
    amount: Math.round((r.amount * YEAR_FACTOR[fiscalYear]) / 1000) * 1000,
  }));
}

// BFARS 10 (QRROR): the Q1 sample receipts; later quarters reuse them as that quarter's receipts (dates shifted, amounts scaled).
const QRROR_QUARTER_FACTOR: Record<Quarter, number> = { Q1: 1, Q2: 0.7, Q3: 1.1, Q4: 0.8 };
const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function qrrorQuarterRows(fiscalYear: number, quarter: Quarter): QrrorRow[] {
  const qi = QUARTERS.indexOf(quarter);
  const factor = QRROR_QUARTER_FACTOR[quarter] * YEAR_FACTOR[fiscalYear];
  return QRROR_Q1_ROWS.map((r, i) => ({
    ...r,
    referenceNo: `RV-${fiscalYear}-${String(qi * QRROR_Q1_ROWS.length + i + 1).padStart(3, "0")}`,
    date: `${fiscalYear}-${String(Number(r.date.slice(5, 7)) + qi * 3).padStart(2, "0")}-${r.date.slice(8)}`,
    amount: Math.round((r.amount * factor) / 1000) * 1000,
  }));
}

// BFARS 11 (SABUDBTR): the Q1 sample per fund, split into activities. The approved budget is annual; utilizations and
// disbursements are year-to-date, January–March from the workbook and later months per SABUDBTR_LATER_MONTH_FACTOR.
function sabudbtrRows(fiscalYear: number, quarter: Quarter): SabudbtrRow[] {
  const year = YEAR_FACTOR[fiscalYear];
  const lastMonth = (QUARTERS.indexOf(quarter) + 1) * 3;
  const round = (v: number) => Math.round(v / 1000) * 1000;
  return SABUDBTR_FUNDS.flatMap((f) => {
    const q1Util = f.utilizations.reduce((a, b) => a + b, 0);
    const disbRate = q1Util ? f.disbursements.reduce((a, b) => a + b, 0) / q1Util : 0;
    return f.activities.map(([activity, office, share]): SabudbtrRow => {
      const budget = round(f.approvedBudget * share * year);
      let used = 0;
      const months = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const planned = i < 3 ? round(f.utilizations[i] * share * year) : round((q1Util / 3) * SABUDBTR_LATER_MONTH_FACTOR[i - 3] * share * year);
        const utilizations = Math.min(planned, budget - used);
        used += utilizations;
        const disbursements = i < 3 ? round(f.disbursements[i] * share * year) : round(utilizations * disbRate);
        return { month, utilizations, disbursements };
      });
      const ytd = months.slice(0, lastMonth);
      return {
        fund: f.fund,
        uacsCode: f.uacsCode,
        uacsDescription: f.uacsDescription,
        activity,
        office,
        approvedBudget: budget,
        utilizations: ytd.reduce((s, m) => s + m.utilizations, 0),
        disbursements: ytd.reduce((s, m) => s + m.disbursements, 0),
        monthly: ytd.slice(-3),
      };
    });
  });
}

export const reportingHandlers = [
  route("GET", ENDPOINTS.bfars.sabudbtr, ({ query }): SabudbtrReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = str(query.quarter) as Quarter;
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    if (!QUARTERS.includes(quarter)) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    const f = (k: string) => str(query[k]);
    const keep = (rows: SabudbtrRow[]) =>
      rows.filter((r) => (!f("department") || r.office === f("department")) && (!f("fund") || r.fund === f("fund")) && (!f("uacsMajor") || r.uacsCode === f("uacsMajor")));
    const qi = QUARTERS.indexOf(quarter);
    const prevQ = qi ? { fiscalYear, quarter: QUARTERS[qi - 1] } : { fiscalYear: fiscalYear - 1, quarter: "Q4" as Quarter };
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      agency: AGENCIES[0].name,
      rows: keep(sabudbtrRows(fiscalYear, quarter)),
      previousQuarter: prevQ.fiscalYear in YEAR_FACTOR ? { label: `${prevQ.quarter} ${prevQ.fiscalYear}`, rows: keep(sabudbtrRows(prevQ.fiscalYear, prevQ.quarter)) } : null,
      signatories: signatories(),
      options: {
        departments: [...new Set(SABUDBTR_FUNDS.flatMap((x) => x.activities.map(([, office]) => office)))].sort(),
        funds: SABUDBTR_FUNDS.map((x) => x.fund),
        uacsMajors: SABUDBTR_FUNDS.map((x) => ({ code: x.uacsCode, label: x.uacsDescription, fund: x.fund })),
      },
    };
  }),
  route("GET", ENDPOINTS.bfars.qrror, ({ query }): QrrorReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = str(query.quarter) as Quarter;
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    if (!QUARTERS.includes(quarter)) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    const f = (k: string) => str(query[k]);
    const keep = (rows: QrrorRow[]) =>
      rows.filter(
        (r) =>
          (!f("department") || r.office === f("department")) &&
          (!f("classification") || r.classification === f("classification")) &&
          (!f("uacsMajor") || r.uacsCode === f("uacsMajor")),
      );
    const qi = QUARTERS.indexOf(quarter);
    const prevQ = qi ? { fiscalYear, quarter: QUARTERS[qi - 1] } : { fiscalYear: fiscalYear - 1, quarter: "Q4" as Quarter };
    const label = (fy: number, q: Quarter) => `${q} ${fy}`;
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      agency: AGENCIES[0].name,
      rows: keep(QUARTERS.slice(0, qi + 1).flatMap((q) => qrrorQuarterRows(fiscalYear, q))),
      previousQuarter: prevQ.fiscalYear in YEAR_FACTOR ? { label: label(prevQ.fiscalYear, prevQ.quarter), rows: keep(qrrorQuarterRows(prevQ.fiscalYear, prevQ.quarter)) } : null,
      previousYear: fiscalYear - 1 in YEAR_FACTOR ? { label: label(fiscalYear - 1, quarter), rows: keep(qrrorQuarterRows(fiscalYear - 1, quarter)) } : null,
      signatories: signatories(),
      options: {
        departments: [...new Set(QRROR_Q1_ROWS.map((r) => r.office))].sort(),
        uacsMajors: QRROR_ACCOUNTS,
      },
    };
  }),
  route("GET", ENDPOINTS.bfars.mrd, ({ query }): MrdReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const month = num(query.month, 0);
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new MockHttpError(422, "Select a valid month.", { month: "Select a valid month." });
    const all = mrdRows(fiscalYear);
    const through = `${fiscalYear}-${String(month).padStart(2, "0")}-31`;
    const f = (k: string) => str(query[k]);
    const rows = all.filter(
      (r) =>
        r.date <= through &&
        (!f("department") || r.office === f("department")) &&
        (!f("allotmentClass") || r.allotmentClass === f("allotmentClass")) &&
        (!f("uacsMajor") || r.uacsCode.replace(/-/g, "").startsWith(f("uacsMajor"))),
    );
    const monthName = new Date(Date.UTC(fiscalYear, month - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    return {
      fiscalYear,
      month,
      period: `FY ${fiscalYear} • ${monthName} ${fiscalYear}`,
      agency: AGENCIES[0].name,
      rows,
      signatories: signatories(),
      options: {
        departments: [...new Set(all.map((r) => r.office))].sort(),
        uacsMajors: OBJECT_CLASSES.map((c) => ({ code: c.major, label: `${c.code} (${c.major}) – ${c.name}` })),
      },
    };
  }),
  route("GET", ENDPOINTS.bfars.auo, ({ query }): AuoReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const asOf = str(query.asOf);
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf)) || Number(asOf.slice(0, 4)) !== fiscalYear)
      throw new MockHttpError(422, "Select an as-of date within the fiscal year.", { asOf: "Select an as-of date within the fiscal year." });
    const all = auoRows(fiscalYear);
    const f = (k: string) => str(query[k]);
    const rows = all.filter(
      (r) =>
        r.dateObligated <= asOf &&
        (!f("department") || r.office === f("department")) &&
        (!f("allotmentClass") || r.allotmentClass === f("allotmentClass")) &&
        (!f("uacsMajor") || r.uacsCode.replace(/-/g, "").startsWith(f("uacsMajor"))),
    );
    const quarter = `Q${Math.ceil(Number(asOf.slice(5, 7)) / 3)}`;
    return {
      fiscalYear,
      asOf,
      period: `FY ${fiscalYear} • As of ${new Date(`${asOf}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} (${QUARTER_LABEL[quarter]})`,
      agency: AGENCIES[0].name,
      rows,
      signatories: signatories(),
      options: {
        departments: [...new Set(all.map((r) => r.office))].sort(),
        uacsMajors: OBJECT_CLASSES.map((c) => ({ code: c.major, label: `${c.code} (${c.major}) – ${c.name}` })),
      },
    };
  }),
  route("GET", ENDPOINTS.bfars.sabudboe, ({ query }): SabudboeReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = (str(query.quarter) || "Q1") as Quarter;
    if (!QUARTER_LABEL[quarter]) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    const filters = [str(query.department), str(query.allotmentClass), str(query.uacsMajor)] as const;
    const prevYear = fiscalYear - 1;
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      asOf: `${fiscalYear}-${QUARTER_END[quarter]}`,
      agency: AGENCIES[0].name,
      fundSource: "General Appropriations Act (GAA)",
      rows: sabudboeRows(fiscalYear, quarter, ...filters),
      previous: prevYear in YEAR_FACTOR ? { fiscalYear: prevYear, rows: sabudboeRows(prevYear, quarter, ...filters) } : null,
      signatories: signatories(),
      options: {
        departments: [...new Set(Object.values(SAAODBOE_SPLITS).flatMap((s) => s.offices.map(([o]) => o)))].sort(),
        uacsMajors: OBJECT_CLASSES.map((c) => ({ code: c.major, label: `${c.code} (${c.major}) – ${c.name}` })),
      },
    };
  }),
  route("GET", ENDPOINTS.bfars.sabudb, ({ query }): SabudbReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = (str(query.quarter) || "Q1") as Quarter;
    if (!QUARTER_LABEL[quarter]) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    const filters = [str(query.department), str(query.allotmentClass), str(query.uacsMajor)] as const;
    const prevYear = fiscalYear - 1;
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      asOf: `${fiscalYear}-${QUARTER_END[quarter]}`,
      agency: AGENCIES[0].name,
      fundSource: "General Appropriations Act (GAA)",
      rows: sabudbRows(fiscalYear, quarter, ...filters),
      previous: prevYear in YEAR_FACTOR ? { fiscalYear: prevYear, rows: sabudbRows(prevYear, quarter, ...filters) } : null,
      signatories: signatories(),
      options: {
        departments: [...new Set(Object.values(SAAODBOE_SPLITS).flatMap((s) => s.offices.map(([o]) => o)))].sort(),
        uacsMajors: OBJECT_CLASSES.map((c) => ({ code: c.major, label: `${c.code} (${c.major}) – ${c.name}` })),
      },
    };
  }),
  route("GET", ENDPOINTS.bfars.sodlbiaft, ({ query }): SodlbiaftReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = (str(query.quarter) || "Q1") as Quarter;
    if (!QUARTER_LABEL[quarter]) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    const all = sodlbiaftRows(fiscalYear, quarter);
    const f = (k: string) => str(query[k]);
    const rows = all.filter(
      (r) => (!f("office") || r.office === f("office")) && (!f("sourceAgency") || r.sourceAgency === f("sourceAgency")) && (!f("program") || r.program === f("program")),
    );
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      asOf: `${fiscalYear}-${QUARTER_END[quarter]}`,
      agency: AGENCIES[0].name,
      fundSource: "Inter-Agency Fund Transfers (National Government Agencies)",
      rows,
      signatories: signatories(),
      options: {
        offices: [...new Set(all.map((r) => r.office))].sort(),
        sourceAgencies: SODLBIAFT_AGENCIES,
        programs: SODLBIAFT_PROGRAMS,
      },
    };
  }),
  route("GET", ENDPOINTS.bfars.lasa, ({ query }): LasaReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = (str(query.quarter) || "Q1") as Quarter;
    if (!QUARTER_LABEL[quarter]) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    const all = lasaRows(fiscalYear, quarter);
    const f = (k: string) => str(query[k]);
    const rows = all.filter(
      (r) =>
        (!f("department") || r.allottee === f("department")) &&
        (!f("allotmentClass") || r.allotmentClass === f("allotmentClass")) &&
        (!f("uacsMajor") || r.uacsMajor === f("uacsMajor")) &&
        (!f("status") || r.status === f("status")),
    );
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      asOf: `${fiscalYear}-${QUARTER_END[quarter]}`,
      agency: AGENCIES[0].name,
      fundSource: "General Appropriations Act (GAA)",
      appropriations: Math.round(LASA_APPROPRIATIONS * YEAR_FACTOR[fiscalYear]),
      rows,
      signatories: signatories(),
      options: {
        departments: [...new Set(all.map((r) => r.allottee))].sort(),
        uacsMajors: Object.entries(LASA_UACS_LABELS).map(([code, label]) => ({ code, label: `${code} – ${label}` })),
      },
    };
  }),

  // BFARS 3 (SAAODBOE): workbook lines per object of expenditure, scaled to the office/allotment-class share and quarter.
  route("GET", ENDPOINTS.bfars.saaodboe, ({ query }): SaaodboeReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = (str(query.quarter) || "Q1") as Quarter;
    if (!QUARTER_LABEL[quarter]) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    const year = YEAR_FACTOR[fiscalYear];
    const g = SAAODB_GROWTH[quarter];
    const round = (v: number) => Math.round(v / 1000) * 1000;
    const department = str(query.department);
    const allotmentClass = str(query.allotmentClass);
    const uacsMajor = str(query.uacsMajor);
    const rows: SaaodboeRow[] = SAAODBOE_LINES.filter((l) => !uacsMajor || l.uacsCode.startsWith(uacsMajor)).flatMap((l) => {
      const split = SAAODBOE_SPLITS[l.objectClass];
      const office = department ? (split.offices.find(([o]) => o === department)?.[1] ?? 0) : 1;
      const cls = allotmentClass ? (split.classes.find(([c]) => c === allotmentClass)?.[1] ?? 0) : 1;
      const share = office * cls;
      if (!share) return [];
      const appropriations = round(l.appropriations * year * share);
      const allotments = Math.min(round(l.allotments * year * g.allotments * share), appropriations);
      const obligations = Math.min(round(l.obligations * year * g.obligations * share), allotments);
      const disbursements = Math.min(round(l.disbursements * year * g.disbursements * share), obligations);
      return [{ ...l, appropriations, allotments, obligations, disbursements }];
    });
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      asOf: `${fiscalYear}-${QUARTER_END[quarter]}`,
      agency: AGENCIES[0].name,
      fundSource: "General Appropriations Act (GAA)",
      rows,
      remarks: SAAODBOE_REMARKS,
      signatories: signatories(),
      options: {
        departments: [...new Set(Object.values(SAAODBOE_SPLITS).flatMap((s) => s.offices.map(([o]) => o)))].sort(),
        uacsMajors: OBJECT_CLASSES.map((c) => ({ code: c.major, label: `${c.code} (${c.major}) – ${c.name}` })),
      },
    };
  }),

  // BFARS 2 (SAAODB): workbook lines, filtered by office/UACS/class, then summed per class × object.
  route("GET", ENDPOINTS.bfars.saaodb, ({ query }): SaaodbReport => {
    const fiscalYear = num(query.fiscalYear, 2026);
    const quarter = (str(query.quarter) || "Q1") as Quarter;
    if (!QUARTER_LABEL[quarter]) throw new MockHttpError(422, "Select a valid quarter.", { quarter: "Select a valid quarter." });
    if (!(fiscalYear in YEAR_FACTOR)) throw new MockHttpError(422, "Select a valid fiscal year.", { fiscalYear: "Select a valid fiscal year." });
    const year = YEAR_FACTOR[fiscalYear];
    const g = SAAODB_GROWTH[quarter];
    const round = (v: number) => Math.round(v / 1000) * 1000;
    const department = str(query.department);
    const rows: SaaodbRow[] = SAAODB_LINES.filter(
      (l) => (!str(query.uacsMajor) || l.uacsMajor === str(query.uacsMajor)) && (!str(query.allotmentClass) || l.allotmentClass === str(query.allotmentClass)),
    ).flatMap(({ offices, ...l }) => {
      const share = department ? (offices.find(([o]) => o === department)?.[1] ?? 0) : 1;
      if (!share) return [];
      const appropriations = round(l.appropriations * year * share);
      const allotments = Math.min(round(l.allotments * year * g.allotments * share), appropriations);
      const obligations = Math.min(round(l.obligations * year * g.obligations * share), allotments);
      const disbursements = Math.min(round(l.disbursements * year * g.disbursements * share), obligations);
      return [{ ...l, objectOfExpenditure: UACS_MAJOR_LABELS[l.uacsMajor] ?? l.objectOfExpenditure, appropriations, allotments, obligations, disbursements }];
    });
    return {
      fiscalYear,
      quarter,
      period: `FY ${fiscalYear} • ${QUARTER_LABEL[quarter]}`,
      asOf: `${fiscalYear}-${QUARTER_END[quarter]}`,
      agency: AGENCIES[0].name,
      fundSource: "General Appropriations Act (GAA)",
      rows,
      signatories: signatories(),
      options: {
        departments: [...new Set(SAAODB_LINES.flatMap((l) => l.offices.map(([o]) => o)))].sort(),
        uacsMajors: [...new Set(SAAODB_LINES.map((l) => l.uacsMajor))].sort().map((code) => ({ code, label: `${code} – ${UACS_MAJOR_LABELS[code]}` })),
      },
    };
  }),

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
