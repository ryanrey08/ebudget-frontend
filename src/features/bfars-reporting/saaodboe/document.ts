import { formatCurrency } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import type { SaaodbFilterLabels } from "../saaodb/document";
import type { ObjectClass, SaaodboeReport, SaaodboeRow } from "./types";

/** Object classes in report order, with the UACS major code and name used in the mockup. */
export const OBJECT_CLASSES: { code: ObjectClass; major: string; name: string; color: string }[] = [
  { code: "PS", major: "501", name: "Personnel Services", color: "#2f7cf6" },
  { code: "MOOE", major: "502", name: "Maintenance and Other Operating Expenses", color: "#ec2027" },
  { code: "CO", major: "503", name: "Capital Outlay", color: "#3cb455" },
  { code: "FE", major: "504", name: "Financial Expenses", color: "#f7a01d" },
  { code: "Others", major: "505", name: "Others", color: "#8b5cf6" },
];

/**
 * Derived columns as defined in the SAAODBOE sample workbook ("Report Notes"):
 * unobligated balance = allotments − obligations; % utilization = obligations ÷ allotments.
 */
export const unobligated = (r: Pick<SaaodboeRow, "allotments" | "obligations">) => r.allotments - r.obligations;
export const utilizationRate = (r: Pick<SaaodboeRow, "allotments" | "obligations">) => (r.allotments > 0 ? r.obligations / r.allotments : 0);

export interface SaaodboeTotals {
  appropriations: number;
  allotments: number;
  obligations: number;
  disbursements: number;
}
export const sumRows = (rows: SaaodboeTotals[]): SaaodboeTotals =>
  rows.reduce(
    (t, r) => ({ appropriations: t.appropriations + r.appropriations, allotments: t.allotments + r.allotments, obligations: t.obligations + r.obligations, disbursements: t.disbursements + r.disbursements }),
    { appropriations: 0, allotments: 0, obligations: 0, disbursements: 0 },
  );

export interface ObjectClassGroup {
  code: ObjectClass;
  major: string;
  name: string;
  color: string;
  /** e.g. "PS (501)" */
  label: string;
  rows: SaaodboeRow[];
  totals: SaaodboeTotals;
}

/** Lines grouped by object class in report order; classes without lines are left out. */
export function groupByObjectClass(rows: SaaodboeRow[]): ObjectClassGroup[] {
  return OBJECT_CLASSES.map((c) => {
    const inClass = rows.filter((r) => r.objectClass === c.code);
    return { ...c, label: `${c.code} (${c.major})`, rows: inClass, totals: sumRows(inClass) };
  }).filter((g) => g.rows.length);
}

export const groupTitle = (g: Pick<ObjectClassGroup, "label" | "name">) => `${g.label} – ${g.name}`;

export interface SaaodboeDocOptions {
  cover: boolean;
  summary: boolean;
  detailed: boolean;
  totalPerMajor: boolean;
  signature: boolean;
}

const QUARTER_TEXT: Record<string, string> = { Q1: "1st Quarter", Q2: "2nd Quarter", Q3: "3rd Quarter", Q4: "4th Quarter" };
const peso = (v: number) => formatCurrency(v).replace("₱", "");
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
/** "March 31, 2026", as printed on the form. */
export const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const SAAODBOE_TITLE = "Summary of Appropriations, Allotments, Obligations, Disbursements and Balances by Object of Expenditures";
const COLUMNS = ["Appropriations<br/>(₱)", "Allotments<br/>(₱)", "Obligations<br/>(₱)", "Disbursements<br/>(₱)", "Unobligated<br/>Balance<br/>(₱)", "% Utilization"];
const amounts = (t: SaaodboeTotals) => [peso(t.appropriations), peso(t.allotments), peso(t.obligations), peso(t.disbursements), peso(unobligated(t)), pct(utilizationRate(t))];
const amountCells = (t: SaaodboeTotals) => amounts(t).map((v) => `<td class="n">${v}</td>`).join("");

/** Printable SAAODBOE report (HTML pages), used for the preview, PDF (print) and download. */
export function buildSaaodboeDocument(report: SaaodboeReport, opts: SaaodboeDocOptions, labels: SaaodbFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const groups = groupByObjectClass(report.rows);
  const grand = sumRows(report.rows);
  const pages: string[] = [];
  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 3<br/>(SAAODBOE)<br/><span>Annex C</span></div></div>`;
  const title = `<h1>SUMMARY OF APPROPRIATIONS, ALLOTMENTS, OBLIGATIONS, DISBURSEMENTS AND BALANCES<br/>BY OBJECT OF EXPENDITURES</h1><p class="asof">As of ${esc(longDate(report.asOf))}<br/>(${QUARTER_TEXT[report.quarter]})</p>`;
  const params = `<table class="params"><tr><td>Department/Office</td><td>: ${esc(labels.department)}</td></tr><tr><td>Fund Source</td><td>: ${esc(report.fundSource)}</td></tr><tr><td>Allotment Class</td><td>: ${esc(labels.allotmentClass)}</td></tr><tr><td>UACS (Major)</td><td>: ${esc(labels.uacsMajor)}</td></tr></table>`;
  const head = (first: string, second: string) => `<thead><tr><th class="code">${first}</th><th>${second}</th>${COLUMNS.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
  const grandRow = `<tfoot><tr><td colspan="2" class="c">GRAND TOTAL</td>${amountCells(grand)}</tr></tfoot>`;
  const empty = `<tbody><tr><td colspan="8">No records match the selected parameters.</td></tr></tbody>`;
  const signatures = `<div class="sigs">${report.signatories
    .map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`)
    .join("")}</div>`;
  // The signature block goes under the first statement page (detailed listing, else summary), as in the mockup.
  let signed = !opts.signature;
  const sign = () => {
    if (signed) return "";
    signed = true;
    return signatures;
  };

  if (opts.cover) {
    pages.push(`${header}<div class="cover"><h2>BFARS 3</h2><h1>${SAAODBOE_TITLE.toUpperCase()} (SAAODBOE)</h1><p class="big">Fiscal Year ${report.fiscalYear}<br/>${QUARTER_TEXT[report.quarter]}</p><p>As of ${esc(longDate(report.asOf))}</p><p>${esc(report.fundSource)}</p></div><div class="prep">Prepared by:<br/><b>Budget Office</b><br/>${esc(report.agency)}</div>`);
  }
  if (opts.detailed) {
    const body = groups.length
      ? `<tbody>${groups
          .map(
            (g) =>
              `${opts.totalPerMajor ? `<tr class="grp"><td colspan="2">${esc(groupTitle(g))}</td>${amountCells(g.totals)}</tr>` : ""}${g.rows
                .map((r) => `<tr><td>${esc(r.uacsCode)}</td><td class="ind">${esc(r.objectOfExpenditure)}</td>${amountCells(r)}</tr>`)
                .join("")}`,
          )
          .join("")}</tbody>${grandRow}`
      : empty;
    pages.push(`${header}${title}${params}<table>${head("UACS<br/>Code", "Object of Expenditures")}${body}</table>${sign()}`);
  }
  if (opts.summary) {
    const body = groups.length
      ? `<tbody>${groups.map((g) => `<tr><td class="nw">${esc(g.label)}</td><td>${esc(g.name)}</td>${amountCells(g.totals)}</tr>`).join("")}</tbody>${grandRow}`
      : empty;
    pages.push(`${header}${opts.detailed ? "" : title + params}<h3>Summary by Object of Expenditures</h3><table>${head("Object<br/>Class", "Description")}${body}</table>${sign()}`);
  }
  if (!signed) pages.push(`${header}${title}${params}${sign()}`);
  if (!pages.length) pages.push(`${header}<p>No sections selected.</p>`);

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 3 – SAAODBOE FY ${report.fiscalYear} ${report.quarter}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9.5px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:8mm 12mm 14mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:110px 1fr 110px;align-items:start;gap:10px}.hdr img{width:54px;height:54px;object-fit:contain;margin-left:20px}.org{text-align:center;font-size:10.5px;line-height:1.35}.org b{font-size:11.5px}.form{text-align:right;font-weight:bold;font-size:11px;line-height:1.4}.form span{font-weight:normal}
h1{text-align:center;font-size:11.5px;margin:4px 40px 1px;line-height:1.35}.asof{text-align:center;margin:0 0 6px;font-size:10.5px;line-height:1.35}h2{font-size:40px;margin:0;color:#1e3a8a}h3{font-size:11.5px;color:#1e3a8a;margin:6px 0 4px}
.params{width:auto;margin-bottom:6px}.params td{border:0;padding:0 6px 0 0;font-size:9.5px}.params td:first-child{font-weight:bold;width:100px}
table{width:100%;border-collapse:collapse;margin-bottom:6px}th,td{border:1px solid #94a3b8;padding:2.5px 5px;text-align:left}th{background:#dbeafe;font-size:9px;text-align:center;line-height:1.2}th.code{width:52px}
td.n{text-align:right;white-space:nowrap;width:11%}td.ind{padding-left:14px}td.nw{white-space:nowrap}td.c{text-align:center}
tr.grp td{font-weight:bold;background:#e0ecfb}tfoot td{font-weight:bold;background:#bfdbfe}
.cover{text-align:center;margin-top:22mm;color:#1e3a8a}.cover h1{margin:10px 40mm;font-size:15px}.cover .big{font-size:16px;font-weight:bold;color:#111827;margin-top:18px}.prep{position:absolute;left:0;right:0;bottom:24mm;text-align:center;font-size:11px}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:10px}.sigs p{margin:0}.sigs .line{border-bottom:1px solid #111;height:24px;margin:0 20px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin-top:6px}.sigs i{display:inline-block;width:60%;border-bottom:1px solid #111}
footer{position:absolute;left:12mm;right:12mm;bottom:6mm;display:flex;justify-content:space-between;color:#6b7280;font-size:8px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((p, i) => `<section class="page" id="page-${i + 1}">${p}<footer>${esc(report.agency)} • BFARS 3 – SAAODBOE • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets (detail listing and object summary) for XLSX / XLS export. */
export function buildSaaodboeSheets(report: SaaodboeReport, opts: SaaodboeDocOptions, labels: SaaodbFilterLabels): XlsxSheet[] {
  const amountHead = ["Appropriations", "Allotments", "Obligations", "Disbursements", "Unobligated Balance", "% Utilization"];
  const vals = (t: SaaodboeTotals): XlsxCell[] => [t.appropriations, t.allotments, t.obligations, t.disbursements, unobligated(t), Number(utilizationRate(t).toFixed(4))];
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 3 – ${title}`],
    [`${report.agency} • ${report.period} • As of ${longDate(report.asOf)}`],
    [`Department/Office: ${labels.department} • Fund Source: ${report.fundSource} • Allotment Class: ${labels.allotmentClass} • UACS (Major): ${labels.uacsMajor}`],
    [],
  ];
  const widths = [14, 46, 18, 18, 18, 18, 20, 14, 16];
  const groups = groupByObjectClass(report.rows);
  const grand = sumRows(report.rows);
  const sheets: XlsxSheet[] = [];
  if (opts.detailed) {
    const rows: XlsxCell[][] = [...intro(SAAODBOE_TITLE), ["UACS Code", "Object of Expenditures", ...amountHead]];
    const bold = [0, 4];
    groups.forEach((g) => {
      if (opts.totalPerMajor) {
        bold.push(rows.length);
        rows.push([g.label, g.name, ...vals(g.totals)]);
      }
      g.rows.forEach((r) => rows.push([r.uacsCode, r.objectOfExpenditure, ...vals(r)]));
    });
    bold.push(rows.length);
    rows.push(["GRAND TOTAL", "", ...vals(grand)]);
    sheets.push({ name: "SAAODBOE Detail", rows, boldRows: bold, columnWidths: widths });
  }
  if (opts.summary || !opts.detailed) {
    const rows: XlsxCell[][] = [
      ...intro("Summary by Object of Expenditures"),
      ["Object Class", "Description", ...amountHead, "Remarks"],
      ...groups.map((g) => [g.label, g.name, ...vals(g.totals), report.remarks[g.code] ?? ""]),
      ["GRAND TOTAL", "", ...vals(grand)],
    ];
    sheets.push({ name: "Object Summary", rows, boldRows: [0, 4, rows.length - 1], columnWidths: widths });
  }
  return sheets;
}

export const saaodboeFileName = (report: SaaodboeReport, ext: string) => `MPC_BFARS3_SAAODBOE_FY${report.fiscalYear}_${report.quarter}.${ext}`;
