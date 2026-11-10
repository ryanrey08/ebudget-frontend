import { ALLOTMENT_CLASSES } from "@/lib/constants/allotment-classes";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import { CLASS_ORDER } from "../qpro/document";
import type { SaaodbReport, SaaodbRow } from "./types";

/**
 * Derived columns as defined in the SAAODB sample workbook ("Formula notes"):
 * unobligated = allotments − obligations; % utilization = disbursements ÷ allotments.
 */
export const unobligated = (r: Pick<SaaodbRow, "allotments" | "obligations">) => r.allotments - r.obligations;
export const utilizationRate = (r: Pick<SaaodbRow, "allotments" | "disbursements">) => (r.allotments > 0 ? r.disbursements / r.allotments : 0);

export interface SaaodbTotals {
  appropriations: number;
  allotments: number;
  obligations: number;
  disbursements: number;
}
export const sumRows = (rows: SaaodbTotals[]): SaaodbTotals =>
  rows.reduce(
    (t, r) => ({ appropriations: t.appropriations + r.appropriations, allotments: t.allotments + r.allotments, obligations: t.obligations + r.obligations, disbursements: t.disbursements + r.disbursements }),
    { appropriations: 0, allotments: 0, obligations: 0, disbursements: 0 },
  );

export const classTitle = (code: string) => `${code} – ${ALLOTMENT_CLASSES.find((c) => c.code === code)?.name ?? code}`;

export interface SaaodbClassGroup {
  code: string;
  rows: SaaodbRow[];
  totals: SaaodbTotals;
}

export function groupByClass(rows: SaaodbRow[]): SaaodbClassGroup[] {
  return CLASS_ORDER.map((code) => {
    const inClass = rows.filter((r) => r.allotmentClass === code);
    return { code, rows: inClass, totals: sumRows(inClass) };
  }).filter((g) => g.rows.length);
}

export interface SaaodbDocOptions {
  cover: boolean;
  summary: boolean;
  detailed: boolean;
  perUacs: boolean;
  signature: boolean;
}

const QUARTER_TEXT: Record<string, string> = { Q1: "1st Quarter", Q2: "2nd Quarter", Q3: "3rd Quarter", Q4: "4th Quarter" };
const peso = (v: number) => formatCurrency(v).replace("₱", "");
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const SAAODB_TITLE = "Statement of Appropriations, Allotments, Obligations, Disbursements and Balances";
const COLUMNS = ["Appropriations (₱)", "Allotments (₱)", "Obligations (₱)", "Disbursements (₱)", "Unobligated Balance (₱)", "% Utilization"];
const amounts = (t: SaaodbTotals) => [peso(t.appropriations), peso(t.allotments), peso(t.obligations), peso(t.disbursements), peso(unobligated(t)), pct(utilizationRate(t))];

export interface SaaodbFilterLabels {
  department: string;
  uacsMajor: string;
  allotmentClass: string;
}

/** Printable SAAODB report (HTML pages), used for the preview, PDF (print) and download. */
export function buildSaaodbDocument(report: SaaodbReport, opts: SaaodbDocOptions, labels: SaaodbFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const groups = groupByClass(report.rows);
  const grand = sumRows(report.rows);
  const pages: string[] = [];
  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 2<br/>(SAAODB)<br/><span>Annex B</span></div></div>`;
  const title = `<h1>${SAAODB_TITLE.toUpperCase()}</h1><p class="asof">As of ${esc(formatDate(report.asOf))}<br/>(${QUARTER_TEXT[report.quarter]})</p>`;
  const params = `<table class="params"><tr><td>Department/Office</td><td>: ${esc(labels.department)}</td></tr><tr><td>Fund Source</td><td>: ${esc(report.fundSource)}</td></tr><tr><td>UACS (Major)</td><td>: ${esc(labels.uacsMajor)}</td></tr><tr><td>Allotment Class</td><td>: ${esc(labels.allotmentClass)}</td></tr></table>`;
  const head = `<thead><tr><th>Allotment Class</th><th>Object of Expenditure (UACS)</th>${COLUMNS.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
  const signatures = opts.signature
    ? `<div class="sigs">${report.signatories.map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: ________________</p></div>`).join("")}</div>`
    : "";

  if (opts.cover) {
    pages.push(`${header}<div class="cover"><h2>BFARS 2</h2><h1>${SAAODB_TITLE.toUpperCase()}</h1><p class="big">Fiscal Year ${report.fiscalYear}<br/>${QUARTER_TEXT[report.quarter]}</p><p>As of ${esc(formatDate(report.asOf))}</p></div><div class="prep">Prepared by:<br/><b>Budget Office</b><br/>${esc(report.agency)}</div>`);
  }
  if (opts.summary) {
    const body = groups.length
      ? `<tbody>${groups.map((g) => `<tr><td colspan="2"><b>${esc(classTitle(g.code))}</b></td>${amounts(g.totals).map((v) => `<td class="n">${v}</td>`).join("")}</tr>`).join("")}</tbody><tfoot><tr><td colspan="2">GRAND TOTAL</td>${amounts(grand).map((v) => `<td class="n">${v}</td>`).join("")}</tr></tfoot>`
      : `<tbody><tr><td colspan="8">No records match the selected parameters.</td></tr></tbody>`;
    pages.push(`${header}${title}${params}<h3>Summary by Allotment Class</h3><table>${head.replace("<th>Object of Expenditure (UACS)</th>", "<th></th>")}${body}</table>${opts.detailed || opts.perUacs ? "" : signatures}`);
  }
  if (opts.detailed) {
    const body = groups.length
      ? `<tbody>${groups
          .map(
            (g, gi) =>
              `<tr class="grp"><td colspan="8">${gi + 1}. ${esc(classTitle(g.code))}</td></tr>${g.rows
                .map((r) => `<tr><td></td><td>${esc(r.uacsMajor)} – ${esc(r.objectOfExpenditure)}</td>${amounts(r).map((v) => `<td class="n">${v}</td>`).join("")}</tr>`)
                .join("")}<tr class="sub"><td colspan="2">Total ${esc(g.code)}</td>${amounts(g.totals).map((v) => `<td class="n">${v}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody><tfoot><tr><td colspan="2">GRAND TOTAL</td>${amounts(grand).map((v) => `<td class="n">${v}</td>`).join("")}</tr></tfoot>`
      : `<tbody><tr><td colspan="8">No records match the selected parameters.</td></tr></tbody>`;
    pages.push(`${header}${opts.summary ? "" : title + params}<h3>Detailed Breakdown by Allotment Class and Object of Expenditure</h3><table>${head}${body}</table>${opts.perUacs ? "" : signatures}`);
  }
  if (opts.perUacs) {
    const majors = [...new Set(report.rows.map((r) => r.uacsMajor))].sort();
    const body = majors
      .map((m) => {
        const rs = report.rows.filter((r) => r.uacsMajor === m);
        return `<tr><td>${esc(m)}</td><td>${esc(rs[0].objectOfExpenditure)}</td>${amounts(sumRows(rs)).map((v) => `<td class="n">${v}</td>`).join("")}</tr>`;
      })
      .join("");
    pages.push(`${header}<h3>Listing per UACS (Major)</h3><table><thead><tr><th>UACS (Major)</th><th>Object of Expenditure</th>${COLUMNS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body || '<tr><td colspan="8">No records.</td></tr>'}</tbody><tfoot><tr><td colspan="2">GRAND TOTAL</td>${amounts(grand).map((v) => `<td class="n">${v}</td>`).join("")}</tr></tfoot></table>${signatures}`);
  }
  if (opts.signature && !opts.summary && !opts.detailed && !opts.perUacs) pages.push(`${header}${title}${params}${signatures}`);
  if (!pages.length) pages.push(`${header}<p>No sections selected.</p>`);

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 2 – SAAODB FY ${report.fiscalYear} ${report.quarter}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:10px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:10mm 12mm 16mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:70px 1fr 120px;align-items:center;gap:10px;margin-bottom:6px}.hdr img{width:56px;height:56px;object-fit:contain}.org{text-align:center;font-size:11px}.org b{font-size:13px}.form{text-align:right;font-weight:bold;font-size:11px}.form span{font-weight:normal}
h1{text-align:center;font-size:14px;margin:6px 60px 2px}.asof{text-align:center;margin:0 0 8px;font-size:11px}h2{font-size:40px;margin:0;color:#1e3a8a}h3{font-size:12px;color:#1e3a8a;margin:8px 0 4px}
.params td{border:0;padding:1px 6px 1px 0;font-size:10px}.params td:first-child{font-weight:bold;width:110px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #94a3b8;padding:3px 5px;text-align:left}th{background:#dbeafe;font-size:9px;text-align:center}td.n{text-align:right;white-space:nowrap}
tr.grp td{font-weight:bold;background:#f8fafc}tr.sub td{font-weight:bold;background:#dbeafe}tfoot td{font-weight:bold;background:#bfdbfe}.params{width:auto;margin-bottom:8px}
.cover{text-align:center;margin-top:22mm;color:#1e3a8a}.cover h1{margin:10px 40mm}.cover .big{font-size:16px;font-weight:bold;color:#111827;margin-top:18px}.prep{position:absolute;left:0;right:0;bottom:24mm;text-align:center;font-size:11px}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:16px}.sigs .line{border-bottom:1px solid #111;height:28px;margin:0 10px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin-top:8px}
footer{position:absolute;left:12mm;right:12mm;bottom:7mm;display:flex;justify-content:space-between;color:#6b7280;font-size:8px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((p, i) => `<section class="page" id="page-${i + 1}">${p}<footer>${esc(report.agency)} • BFARS 2 – SAAODB • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets (Summary, Detailed, per UACS) for XLSX / XLS export. */
export function buildSaaodbSheets(report: SaaodbReport, opts: SaaodbDocOptions, labels: SaaodbFilterLabels): XlsxSheet[] {
  const head = ["Allotment Class", "UACS (Major)", "Object of Expenditure", "Appropriations", "Allotments", "Obligations", "Disbursements", "Unobligated Balance", "% Utilization", "Remarks"];
  const vals = (t: SaaodbTotals): XlsxCell[] => [t.appropriations, t.allotments, t.obligations, t.disbursements, unobligated(t), Number(utilizationRate(t).toFixed(4))];
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 2 – ${title}`],
    [`${report.agency} • ${report.period} • As of ${formatDate(report.asOf)}`],
    [`Department/Office: ${labels.department} • Fund Source: ${report.fundSource} • UACS (Major): ${labels.uacsMajor} • Allotment Class: ${labels.allotmentClass}`],
    [],
  ];
  const widths = [16, 12, 38, 18, 18, 18, 18, 20, 14, 14];
  const groups = groupByClass(report.rows);
  const grand = sumRows(report.rows);
  const sheets: XlsxSheet[] = [];
  if (opts.summary || (!opts.detailed && !opts.perUacs)) {
    const rows: XlsxCell[][] = [...intro("SAAODB Summary by Allotment Class"), ["Allotment Class", "", "", ...head.slice(3, 9)], ...groups.map((g) => [g.code, "", classTitle(g.code), ...vals(g.totals)]), ["GRAND TOTAL", "", "", ...vals(grand)]];
    sheets.push({ name: "Summary", rows, boldRows: [0, 4, rows.length - 1], columnWidths: widths });
  }
  if (opts.detailed) {
    const rows: XlsxCell[][] = [...intro(SAAODB_TITLE), head];
    const bold = [0, 4];
    groups.forEach((g) => {
      g.rows.forEach((r) => rows.push([r.allotmentClass, r.uacsMajor, r.objectOfExpenditure, ...vals(r), r.remarks]));
      bold.push(rows.length);
      rows.push([`Total ${g.code}`, "", "", ...vals(g.totals)]);
    });
    bold.push(rows.length);
    rows.push(["GRAND TOTAL", "", "", ...vals(grand)]);
    sheets.push({ name: "SAAODB Detail", rows, boldRows: bold, columnWidths: widths });
  }
  if (opts.perUacs) {
    const majors = [...new Set(report.rows.map((r) => r.uacsMajor))].sort();
    const rows: XlsxCell[][] = [...intro("Listing per UACS (Major)"), ["UACS (Major)", "", "Object of Expenditure", ...head.slice(3, 9)], ...majors.map((m) => {
      const rs = report.rows.filter((r) => r.uacsMajor === m);
      return [m, "", rs[0].objectOfExpenditure, ...vals(sumRows(rs))];
    }), ["GRAND TOTAL", "", "", ...vals(grand)]];
    sheets.push({ name: "Per UACS", rows, boldRows: [0, 4, rows.length - 1], columnWidths: widths });
  }
  return sheets;
}

export const saaodbFileName = (report: SaaodbReport, ext: string) => `MPC_BFARS2_SAAODB_FY${report.fiscalYear}_${report.quarter}.${ext}`;
