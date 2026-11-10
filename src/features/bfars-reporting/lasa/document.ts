import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import { CLASS_ORDER } from "../qpro/document";
import { classTitle } from "../saaodb/document";
import { LASA_STATUSES, type LasaReport, type LasaRow } from "./types";

/** As defined in the LASA sample workbook ("Read Me"): Balance = Allotment − Released. */
export const balanceOf = (r: Pick<LasaTotals, "allotmentAmount" | "releasedAmount">) => r.allotmentAmount - r.releasedAmount;

/** Record date as in the LASA mockups, e.g. "Jan 05, 2026". */
export const lasaDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

export interface LasaTotals {
  count: number;
  allotmentAmount: number;
  subAllotmentAmount: number;
  releasedAmount: number;
}
export const sumRows = (rows: LasaRow[]): LasaTotals =>
  rows.reduce(
    (t, r) => ({ count: t.count + 1, allotmentAmount: t.allotmentAmount + r.allotmentAmount, subAllotmentAmount: t.subAllotmentAmount + r.subAllotmentAmount, releasedAmount: t.releasedAmount + r.releasedAmount }),
    { count: 0, allotmentAmount: 0, subAllotmentAmount: 0, releasedAmount: 0 },
  );

export interface LasaGroup {
  key: string;
  rows: LasaRow[];
  totals: LasaTotals;
}
const groupOf = (keys: readonly string[], rows: LasaRow[], keyOf: (r: LasaRow) => string): LasaGroup[] =>
  keys.map((key) => {
    const inGroup = rows.filter((r) => keyOf(r) === key);
    return { key, rows: inGroup, totals: sumRows(inGroup) };
  });

/** Per allotment class (classes without records are left out). */
export const groupByClass = (rows: LasaRow[]) => groupOf(CLASS_ORDER, rows, (r) => r.allotmentClass).filter((g) => g.rows.length);
/** Per status, every status listed (as in the report's "Summary by Status"). */
export const groupByStatus = (rows: LasaRow[]) => groupOf(LASA_STATUSES, rows, (r) => r.status);

/** Allotment and sub-allotment amounts per month of the quarter. */
export function monthlyTotals(rows: LasaRow[], fiscalYear: number, quarter: string) {
  const first = (Number(quarter.slice(1)) - 1) * 3 + 1;
  return [first, first + 1, first + 2].map((m) => {
    const t = sumRows(rows.filter((r) => Number(r.date.slice(5, 7)) === m));
    const month = new Date(fiscalYear, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return { month, allotments: t.allotmentAmount, subAllotments: t.subAllotmentAmount };
  });
}

/** Allottee offices ranked by allotment amount. */
export function topAllottees(rows: LasaRow[], limit = 5) {
  const byOffice = new Map<string, number>();
  rows.forEach((r) => byOffice.set(r.allottee, (byOffice.get(r.allottee) ?? 0) + r.allotmentAmount));
  return [...byOffice.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([office, amount]) => ({ office, amount }));
}

export interface LasaDocOptions {
  cover: boolean;
  summary: boolean;
  groupByClass: boolean;
  subAllotments: boolean;
  status: boolean;
  signature: boolean;
}

export interface LasaFilterLabels {
  department: string;
  uacsMajor: string;
  allotmentClass: string;
  status: string;
}

export const LASA_TITLE = "List of Allotments and Sub-Allotments (LASA)";
const QUARTER_TEXT: Record<string, string> = { Q1: "1st Quarter", Q2: "2nd Quarter", Q3: "3rd Quarter", Q4: "4th Quarter" };
const peso = (v: number) => formatCurrency(v).replace("₱", "");
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Lines that fit on a landscape A4 page: the first page also carries the title and parameters.
const FIRST_PAGE_LINES = 27;
const PAGE_LINES = 34;
const SUMMARY_LINES = 10;
const SIGNATURE_LINES = 7;

/** Printable LASA report (HTML pages), used for the preview, PDF (print) and download. */
export function buildLasaDocument(report: LasaReport, opts: LasaDocOptions, labels: LasaFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const groups = groupByClass(report.rows);
  const grand = sumRows(report.rows);
  const pages: string[] = [];
  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 4<br/>(LASA)<br/>Annex D</div></div>`;
  const title = `<h1>${LASA_TITLE.toUpperCase()}</h1><p class="asof">As of ${esc(new Date(report.asOf).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}<br/>(${QUARTER_TEXT[report.quarter]})</p>`;
  const paramRows: [string, string][] = [
    ["Department/Office", labels.department],
    ["Fund Source", report.fundSource],
    ["UACS (Major)", labels.uacsMajor],
    ["Allotment Class", labels.allotmentClass],
    ...(labels.status !== "All" ? [["Status", labels.status] as [string, string]] : []),
  ];
  const params = `<table class="params">${paramRows.map(([k, v]) => `<tr><td>${k}</td><td>:</td><td>${esc(v)}</td></tr>`).join("")}</table>`;

  // Detail table columns (Sub-Allotment Amount and Status are optional).
  const heads = ["#", "Allotment No.", "Date", "Allotment Class", "UACS (Major)", "Object of Expenditures", "Allottee (Office)", "Allotment Amount (₱)", ...(opts.subAllotments ? ["Sub-Allotment Amount (₱)"] : []), "Released Amount (₱)", "Balance (₱)", ...(opts.status ? ["Status"] : [])];
  const amountCells = (t: Pick<LasaTotals, "allotmentAmount" | "subAllotmentAmount" | "releasedAmount">) =>
    [t.allotmentAmount, ...(opts.subAllotments ? [t.subAllotmentAmount] : []), t.releasedAmount, balanceOf(t)].map((v) => `<td class="n">${peso(v)}</td>`).join("");
  const statusCell = (s: string) => (opts.status ? `<td class="c">${esc(s)}</td>` : "");
  const thead = `<thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
  const totalLine = (label: string, t: LasaTotals, cls: string) => `<tr class="${cls}"><td colspan="7">${esc(label)}</td>${amountCells(t)}${opts.status ? "<td></td>" : ""}</tr>`;

  const lines: string[] = [];
  let n = 0;
  const rowLine = (r: LasaRow) =>
    `<tr><td class="c">${++n}</td><td>${esc(r.allotmentNo)}</td><td>${esc(lasaDate(r.date))}</td><td class="c">${r.allotmentClass}</td><td class="c">${esc(r.uacsMajor)}</td><td>${esc(r.objectOfExpenditure)}</td><td>${esc(r.allottee)}</td>${amountCells(r)}${statusCell(r.status)}</tr>`;
  if (opts.groupByClass) {
    groups.forEach((g) => {
      lines.push(`<tr class="grp"><td colspan="${heads.length}">${esc(classTitle(g.key))}</td></tr>`);
      g.rows.forEach((r) => lines.push(rowLine(r)));
      lines.push(totalLine(`Total ${g.key}`, g.totals, "sub"));
    });
  } else {
    report.rows.forEach((r) => lines.push(rowLine(r)));
  }
  if (!lines.length) lines.push(`<tr><td colspan="${heads.length}" class="c">No records match the selected parameters.</td></tr>`);
  lines.push(totalLine("GRAND TOTAL", grand, "total"));

  const classHeads = ["Allotment Class", "Allotment Amount (₱)", ...(opts.subAllotments ? ["Sub-Allotment Amount (₱)"] : []), "Released Amount (₱)", "Balance (₱)"];
  const classSummary = `<div><h3>Summary by Allotment Class</h3><table class="sum"><thead><tr>${classHeads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${groups
    .map((g) => `<tr><td>${g.key}</td>${amountCells(g.totals)}</tr>`)
    .join("") || `<tr><td colspan="${classHeads.length}">No records.</td></tr>`}</tbody><tfoot><tr><td class="c">TOTAL</td>${amountCells(grand)}</tr></tfoot></table></div>`;
  const statusSummary = `<div><h3>Summary by Status</h3><table class="sum"><thead><tr><th>Status</th><th>No. of Records</th><th>Allotment Amount (₱)</th></tr></thead><tbody>${groupByStatus(report.rows)
    .map((g) => `<tr><td>${g.key}</td><td class="c">${g.totals.count}</td><td class="n">${peso(g.totals.allotmentAmount)}</td></tr>`)
    .join("")}</tbody><tfoot><tr><td class="c">TOTAL</td><td class="c">${grand.count}</td><td class="n">${peso(grand.allotmentAmount)}</td></tr></tfoot></table></div>`;
  const summaries = opts.summary ? `<div class="sums${opts.status ? "" : " one"}">${classSummary}${opts.status ? statusSummary : ""}</div>` : "";
  const signatures = opts.signature
    ? `<div class="sigs">${report.signatories.map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`).join("")}</div>`
    : "";

  if (opts.cover) {
    pages.push(`${header}<div class="cover"><h2>BFARS 4</h2><h1>${LASA_TITLE.toUpperCase()}</h1><p class="big">Fiscal Year ${report.fiscalYear}<br/>${QUARTER_TEXT[report.quarter]}</p><p>As of ${esc(formatDate(report.asOf))}</p>${params}</div><div class="prep">Prepared by:<br/><b>Budget Office</b><br/>${esc(report.agency)}</div>`);
  }

  // Detail pages, then the summaries and signatures on the last page when they fit.
  let start = 0;
  let room = 0;
  for (let p = 0; start < lines.length; p++) {
    const cap = p === 0 ? FIRST_PAGE_LINES : PAGE_LINES;
    const chunk = lines.slice(start, start + cap);
    start += cap;
    room = cap - chunk.length;
    pages.push(`${header}${p === 0 ? title + params : `<h3>${LASA_TITLE} (continued)</h3>`}<table class="detail">${thead}<tbody>${chunk.join("")}</tbody></table>`);
  }
  const append = (block: string, size: number) => {
    if (room >= size) {
      pages[pages.length - 1] += block;
      room -= size;
    } else {
      pages.push(`${header}${block}`);
      room = PAGE_LINES - size;
    }
  };
  if (summaries) append(summaries, SUMMARY_LINES);
  if (signatures) append(signatures, SIGNATURE_LINES);

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 4 – LASA FY ${report.fiscalYear} ${report.quarter}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9.5px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:9mm 11mm 15mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:70px 1fr 120px;align-items:center;gap:10px;margin-bottom:4px}.hdr img{width:56px;height:56px;object-fit:contain}.org{text-align:center;font-size:11px;line-height:1.35}.org b{font-size:13px}.form{text-align:right;font-weight:bold;font-size:12px;line-height:1.3}
h1{text-align:center;font-size:14px;margin:4px 60px 2px}.asof{text-align:center;margin:0 0 6px;font-size:11px;line-height:1.35}h2{font-size:40px;margin:0;color:#1e3a8a}h3{font-size:12px;color:#1e3a8a;margin:8px 0 4px}
.params{width:auto;border-collapse:collapse;margin-bottom:6px}.params td{border:0;padding:1px 6px 1px 0;font-size:10px}.params td:first-child{font-weight:bold;width:110px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #94a3b8;padding:3px 4px;text-align:left;vertical-align:middle}th{background:#dbeafe;font-size:9px;text-align:center}td.n{text-align:right;white-space:nowrap}td.c{text-align:center}
.detail td{white-space:nowrap}tr.grp td{font-weight:bold;background:#f1f5f9}tr.sub td{font-weight:bold;background:#eff6ff}tr.sub td:first-child{text-align:center}tr.total td{font-weight:bold;background:#bfdbfe}tr.total td:first-child{text-align:center}tfoot td{font-weight:bold;background:#bfdbfe}
.sums{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;margin-top:6px}.sums.one{grid-template-columns:1fr}
.cover{text-align:center;margin-top:16mm;color:#1e3a8a}.cover h1{margin:10px 40mm}.cover .big{font-size:16px;font-weight:bold;color:#111827;margin-top:18px}.cover .params{margin:14px auto 0;color:#111827;text-align:left}.prep{position:absolute;left:0;right:0;bottom:24mm;text-align:center;font-size:11px}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:14px}.sigs .line{border-bottom:1px solid #111;height:24px;margin:0 20px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin-top:8px}.sigs .date i{display:inline-block;width:120px;border-bottom:1px solid #111}
footer{position:absolute;left:11mm;right:11mm;bottom:6mm;display:flex;justify-content:space-between;color:#6b7280;font-size:8px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((p, i) => `<section class="page" id="page-${i + 1}">${p}<footer>${esc(report.agency)} • BFARS 4 – LASA • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets (LASA Detail, Class Summary, Status Summary) for XLSX / XLS export. */
export function buildLasaSheets(report: LasaReport, opts: LasaDocOptions, labels: LasaFilterLabels): XlsxSheet[] {
  const amountHeads = ["Allotment Amount", ...(opts.subAllotments ? ["Sub-Allotment Amount"] : []), "Released Amount", "Balance"];
  const amounts = (t: Pick<LasaTotals, "allotmentAmount" | "subAllotmentAmount" | "releasedAmount">): XlsxCell[] => [t.allotmentAmount, ...(opts.subAllotments ? [t.subAllotmentAmount] : []), t.releasedAmount, balanceOf(t)];
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 4 – ${title}`],
    [`${report.agency} • ${report.period} • As of ${formatDate(report.asOf)}`],
    [`Department/Office: ${labels.department} • Fund Source: ${report.fundSource} • UACS (Major): ${labels.uacsMajor} • Allotment Class: ${labels.allotmentClass} • Status: ${labels.status}`],
    [],
  ];
  const groups = groupByClass(report.rows);
  const grand = sumRows(report.rows);
  const pad = (k: number) => Array<XlsxCell>(k).fill("");

  const head = ["#", "Allotment No.", "Date", "Allotment Class", "UACS (Major)", "Object of Expenditures", "Allottee (Office)", ...amountHeads, ...(opts.status ? ["Status"] : []), "Purpose / Remarks"];
  const rows: XlsxCell[][] = [...intro(LASA_TITLE), head];
  const bold = [0, 4];
  let n = 0;
  const line = (r: LasaRow): XlsxCell[] => [++n, r.allotmentNo, lasaDate(r.date), r.allotmentClass, r.uacsMajor, r.objectOfExpenditure, r.allottee, ...amounts(r), ...(opts.status ? [r.status] : []), r.purpose];
  if (opts.groupByClass) {
    groups.forEach((g) => {
      bold.push(rows.length);
      rows.push([classTitle(g.key)]);
      g.rows.forEach((r) => rows.push(line(r)));
      bold.push(rows.length);
      rows.push([`Total ${g.key}`, ...pad(6), ...amounts(g.totals)]);
    });
  } else report.rows.forEach((r) => rows.push(line(r)));
  bold.push(rows.length);
  rows.push(["GRAND TOTAL", ...pad(6), ...amounts(grand)]);
  const sheets: XlsxSheet[] = [{ name: "LASA Detail", rows, boldRows: bold, columnWidths: [6, 15, 14, 10, 10, 26, 28, 18, 18, 18, 18, 12, 30] }];

  if (opts.summary) {
    const cls: XlsxCell[][] = [...intro("Summary by Allotment Class"), ["Allotment Class", ...amountHeads], ...groups.map((g) => [g.key, ...amounts(g.totals)]), ["TOTAL", ...amounts(grand)]];
    sheets.push({ name: "Class Summary", rows: cls, boldRows: [0, 4, cls.length - 1], columnWidths: [18, 20, 20, 20, 20] });
    if (opts.status) {
      const st: XlsxCell[][] = [...intro("Summary by Status"), ["Status", "No. of Records", "Allotment Amount"], ...groupByStatus(report.rows).map((g) => [g.key, g.totals.count, g.totals.allotmentAmount]), ["TOTAL", grand.count, grand.allotmentAmount]];
      sheets.push({ name: "Status Summary", rows: st, boldRows: [0, 4, st.length - 1], columnWidths: [18, 16, 20] });
    }
  }
  return sheets;
}

export const lasaFileName = (report: LasaReport, ext: string) => `MPC_BFARS4_LASA_FY${report.fiscalYear}_${report.quarter}.${ext}`;
