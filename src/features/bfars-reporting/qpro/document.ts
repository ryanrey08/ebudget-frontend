import { formatCurrency, formatDate, formatPercent } from "@/lib/utils/format";
import { accomplishment, groupBy, totalsOf, utilization, type QproGroup } from "./summary";
import type { QproReport, QproRow } from "./types";

export type ReportFormat = "pdf" | "excel" | "word";
export type ReportLayout = "portrait" | "landscape";
export type ReportScope = "both" | "summary" | "details";

export interface QproDocOptions {
  layout: ReportLayout;
  scope: ReportScope;
  include: { cover: boolean; summary: boolean; details: boolean; signature: boolean };
}

export const QPRO_TITLE = "Quarterly Physical Reports of Operation (QPRO)";
export const CLASS_ORDER = ["RAOPS", "RAOMO", "RAOCO", "RAOFE"] as const;
const QUARTER_TEXT: Record<string, string> = {
  Q1: "1st Quarter (January – March)",
  Q2: "2nd Quarter (April – June)",
  Q3: "3rd Quarter (July – September)",
  Q4: "4th Quarter (October – December)",
};

const peso = (v: number) => formatCurrency(v).replace("₱", "");
const pct = (r: number) => formatPercent(r, 2);
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Detail table (one row per program/activity/project). */
export const DETAIL_HEADERS = ["#", "Code", "Program / Activity / Project", "Allotment Class", "UACS (Major)", "Physical Target", "Physical Actual", "Physical %", "Allotment", "Obligation", "Disbursement", "% Utilization", "Status"];
export function detailCells(r: QproRow, i: number): (string | number)[] {
  return [i + 1, r.code, r.program, r.allotmentClass, r.uacsMajor, `${r.physicalTarget}%`, `${r.physicalActual}%`, pct(accomplishment(r.physicalTarget, r.physicalActual)), peso(r.allotment), peso(r.obligations), peso(r.disbursements), pct(utilization(r.allotment, r.disbursements)), r.status];
}

/** Summary table (one row per group). */
export const summaryHeaders = (label: string) => [label, "Programs/Activities", "Target %", "Actual %", "Accomplishment %", "Allotment", "Obligation", "Disbursement", "% Utilization"];
export function summaryCells(g: QproGroup): (string | number)[] {
  return [g.key, g.count, `${g.target.toFixed(2)}%`, `${g.actual.toFixed(2)}%`, pct(accomplishment(g.target, g.actual)), peso(g.allotment), peso(g.obligations), peso(g.disbursements), pct(utilization(g.allotment, g.disbursements))];
}

function table(headers: string[], rows: (string | number)[][], totals?: (string | number)[]) {
  const num = (i: number) => (i > 0 && !Number.isNaN(Number(String(rows[0]?.[i] ?? "").replace(/[,%]/g, ""))) ? ' class="n"' : "");
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td${num(i)}>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody>${totals ? `<tfoot><tr>${totals.map((c, i) => `<td${num(i)}>${esc(c)}</td>`).join("")}</tr></tfoot>` : ""}</table>`;
}

function totalsRow(rows: QproRow[]) {
  const t = totalsOf(rows);
  return ["TOTAL / WEIGHTED", t.count, `${t.target.toFixed(2)}%`, `${t.actual.toFixed(2)}%`, pct(accomplishment(t.target, t.actual)), peso(t.allotment), peso(t.obligations), peso(t.disbursements), pct(utilization(t.allotment, t.disbursements))];
}

export interface QproDocument {
  html: string;
  pageCount: number;
}

/**
 * Builds the printable BFARS 1 report (cover, summary, details, signature page)
 * as a standalone HTML document. Used for the preview, PDF (print) and Word exports.
 */
export function buildQproDocument(report: QproReport, opts: QproDocOptions, ctx: { logoUrl: string; preparedBy: string; generatedAt: string }): QproDocument {
  const landscape = opts.layout === "landscape";
  const showSummary = opts.include.summary && opts.scope !== "details";
  const showDetails = opts.include.details && opts.scope !== "summary";
  const perPage = landscape ? 14 : 20;
  const pages: string[] = [];
  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt="" /><div><div>Republic of the Philippines</div><b>${esc(report.agency.toUpperCase())}</b><div>Marikina City</div></div></div>`;
  const sub = `<p class="sub">BFARS 1 – ${QPRO_TITLE} • FY ${report.fiscalYear} • ${esc(QUARTER_TEXT[report.quarter])}</p>`;

  if (opts.include.cover) {
    pages.push(`${header}<div class="cover"><h1>BFARS 1</h1><h2>QUARTERLY PHYSICAL REPORTS<br/>OF OPERATION (QPRO)</h2><p class="fy">Fiscal Year ${report.fiscalYear}<br/>${esc(QUARTER_TEXT[report.quarter])}</p><p>As of ${esc(formatDate(report.asOf))}</p></div><div class="prep">Prepared by:<br/><b>Budget Office</b><br/>${esc(report.agency)}<br/>Marikina City</div>`);
  }
  if (showSummary) {
    const byClass = groupBy(report.rows, "allotmentClass", CLASS_ORDER);
    const byType = groupBy(report.rows, "programType");
    pages.push(`${header}${sub}<h3>Summary of Physical and Financial Accomplishment</h3><h4>By Allotment Class</h4>${table(summaryHeaders("Allotment Class"), byClass.map(summaryCells), totalsRow(report.rows))}<h4>By Program Type</h4>${table(summaryHeaders("Program Type"), byType.map(summaryCells))}`);
  }
  if (showDetails) {
    for (let i = 0; i < Math.max(report.rows.length, 1); i += perPage) {
      const slice = report.rows.slice(i, i + perPage);
      pages.push(
        `${header}${sub}<h3>Details per Program/Activity/Project${i ? " (continued)" : ""}</h3>${
          slice.length ? table(DETAIL_HEADERS, slice.map((r, k) => detailCells(r, i + k))) : "<p>No programs/activities match the selected parameters.</p>"
        }`,
      );
    }
  }
  if (opts.include.signature) {
    const sig = (role: string, title: string) => `<div class="sig"><p>${role}:</p><div class="line"></div><b>${title}</b><span>Signature over printed name / Date</span></div>`;
    pages.push(`${header}${sub}<h3>Certification</h3><p>The figures in this report are generated from eBudget for FY ${report.fiscalYear}, ${esc(QUARTER_TEXT[report.quarter])}.</p><div class="sigs">${sig("Prepared by", "Budget Officer")}${sig("Reviewed by", "Budget Head")}${sig("Certified correct", "Accountant")}${sig("Approved by", "Head of Agency")}</div>`);
  }
  if (!pages.length) pages.push(`${header}${sub}<p>No sections selected.</p>`);

  const w = landscape ? "297mm" : "210mm";
  const h = landscape ? "210mm" : "297mm";
  const body = pages
    .map((p, i) => `<section class="page" id="page-${i + 1}">${p}<footer>${esc(report.agency)} • BFARS 1 – QPRO • Generated ${esc(ctx.generatedAt)} by ${esc(ctx.preparedBy)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 1 – QPRO FY ${report.fiscalYear} ${report.quarter}</title><style>
@page{size:A4 ${opts.layout};margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:10px}
.page{position:relative;width:${w};height:${h};margin:12px auto;background:#fff;padding:14mm 12mm 18mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1d4ed8;padding-bottom:8px;margin-bottom:10px;font-size:11px}.hdr img{width:46px;height:46px;object-fit:contain}.hdr b{font-size:13px;color:#1e3a8a}
.cover{text-align:center;margin-top:${landscape ? "18mm" : "40mm"};color:#1e3a8a}.cover h1{font-size:46px;margin:0}.cover h2{font-size:22px;margin:8px 0 28px}.cover .fy{font-size:16px;font-weight:bold;color:#111827}
.prep{position:absolute;left:0;right:0;bottom:30mm;text-align:center;font-size:11px}
.sub{color:#4b5563;margin:0 0 6px}h3{font-size:14px;color:#1e3a8a;margin:8px 0}h4{font-size:11px;margin:10px 0 4px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #cbd5e1;padding:3px 4px;text-align:left;vertical-align:top}th{background:#eff6ff;font-size:9px}td.n{text-align:right;white-space:nowrap}tfoot td{font-weight:bold;background:#f8fafc}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:28px 40px;margin-top:30px}.sig .line{border-bottom:1px solid #111;height:36px;margin-bottom:4px}.sig span{display:block;color:#6b7280;font-size:9px}
footer{position:absolute;left:12mm;right:12mm;bottom:8mm;display:flex;justify-content:space-between;color:#6b7280;font-size:8px;border-top:1px solid #e5e7eb;padding-top:4px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${body}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Excel 2003 XML spreadsheet (opens in Excel as .xls) with summary and detail sheets. */
export function buildQproSpreadsheet(report: QproReport, opts: Pick<QproDocOptions, "scope" | "include">): string {
  const cell = (v: string | number) =>
    typeof v === "number" ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  const sheet = (name: string, title: string, headers: string[], rows: (string | number)[][]) =>
    `<Worksheet ss:Name="${esc(name)}"><Table><Row><Cell ss:StyleID="t"><Data ss:Type="String">${esc(title)}</Data></Cell></Row><Row>${cell(`${report.agency} • ${report.period}`)}</Row><Row/><Row>${headers.map((h) => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("")}</Row>${rows.map((r) => `<Row>${r.map(cell).join("")}</Row>`).join("")}</Table></Worksheet>`;
  const t = totalsOf(report.rows);
  const raw = (g: { key: string } & ReturnType<typeof totalsOf>) => [g.key, g.count, Number(g.target.toFixed(2)), Number(g.actual.toFixed(2)), Number(accomplishment(g.target, g.actual).toFixed(4)), g.allotment, g.obligations, g.disbursements, Number(utilization(g.allotment, g.disbursements).toFixed(4))];
  const sheets: string[] = [];
  if (opts.include.summary && opts.scope !== "details") {
    sheets.push(sheet("Summary", "BFARS 1 – QPRO Summary by Allotment Class", summaryHeaders("Allotment Class"), [...groupBy(report.rows, "allotmentClass", CLASS_ORDER).map(raw), raw({ key: "TOTAL / WEIGHTED", ...t })]));
  }
  if (opts.include.details && opts.scope !== "summary") {
    sheets.push(
      sheet("QPRO Detail", "BFARS 1 – QPRO Details per Program/Activity/Project", ["Code", "Program / Activity / Project", "PAP", "Allotment Class", "UACS (Major)", "Department/Office", "Fund Source", "Program Type", "Physical Target %", "Actual %", "Accomplishment %", "Allotment", "Obligation", "Disbursement", "% Utilization", "Status"],
        report.rows.map((r) => [r.code, r.program, r.pap, r.allotmentClass, r.uacsMajor, r.department, r.fundSource, r.programType, r.physicalTarget, r.physicalActual, Number(accomplishment(r.physicalTarget, r.physicalActual).toFixed(4)), r.allotment, r.obligations, r.disbursements, Number(utilization(r.allotment, r.disbursements).toFixed(4)), r.status])),
    );
  }
  if (!sheets.length) sheets.push(sheet("QPRO", "BFARS 1 – QPRO", ["Note"], [["No sections selected."]]));
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="t"><Font ss:Bold="1" ss:Size="13"/></Style><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style></Styles>${sheets.join("")}</Workbook>`;
}

/** Word-compatible document (.doc) from the report HTML. */
export function toWordDocument(html: string) {
  return html.replace("<html>", '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">');
}

export function downloadFile(fileName: string, content: string | Uint8Array, mime: string) {
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Prints an HTML document from a hidden frame (the browser's dialog offers "Save as PDF"). */
export function printDocument(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    throw new Error("Printing is not available in this browser.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = frame.contentWindow;
  const go = () => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  const imgs = [...doc.images].filter((i) => !i.complete);
  if (!imgs.length) setTimeout(go, 50);
  else Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))).then(go);
}

export const qproFileName = (report: QproReport, ext: string) => `MPC_BFARS1_QPRO_FY${report.fiscalYear}_${report.quarter}.${ext}`;
