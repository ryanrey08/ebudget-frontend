import { formatCurrency } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import type { SaaodbFilterLabels } from "../saaodb/document";
import { OBJECT_CLASSES, longDate } from "../saaodboe/document";
import type { ObjectClass } from "../saaodboe/types";
import type { SabudbReport, SabudbRow } from "./types";

export const SABUDB_TITLE = "Statement of Approved Budget, Utilizations, Disbursements and Balances";

export interface SabudbTotals {
  gaaOriginal: number;
  supplemental: number;
  allotments: number;
  obligations: number;
  disbursements: number;
}

/**
 * Derived columns as defined in the BFARS 6 sample workbook ("Read Me"): utilizations equal obligations,
 * balance = approved budget − utilizations, % utilization = utilizations ÷ approved budget.
 */
export const approvedBudget = (t: Pick<SabudbTotals, "gaaOriginal" | "supplemental">) => t.gaaOriginal + t.supplemental;
export const utilizations = (t: Pick<SabudbTotals, "obligations">) => t.obligations;
export const balanceOf = (t: SabudbTotals) => approvedBudget(t) - utilizations(t);
export const utilizationRate = (t: SabudbTotals) => (approvedBudget(t) > 0 ? utilizations(t) / approvedBudget(t) : 0);

export const sumRows = (rows: SabudbTotals[]): SabudbTotals =>
  rows.reduce(
    (t, r) => ({
      gaaOriginal: t.gaaOriginal + r.gaaOriginal,
      supplemental: t.supplemental + r.supplemental,
      allotments: t.allotments + r.allotments,
      obligations: t.obligations + r.obligations,
      disbursements: t.disbursements + r.disbursements,
    }),
    { gaaOriginal: 0, supplemental: 0, allotments: 0, obligations: 0, disbursements: 0 },
  );

/** Short names used on the subtotal rows and the dashboard chart, as in the mockups. */
const SHORT_NAME: Record<ObjectClass, string> = { PS: "Personnel Services", MOOE: "MOOE", CO: "Capital Outlay", FE: "Financial Expenses", Others: "Others" };

export interface SabudbClassGroup {
  code: ObjectClass;
  major: string;
  name: string;
  shortName: string;
  color: string;
  /** e.g. "502 – Maintenance and Other Operating Expenses (MOOE)" */
  title: string;
  rows: SabudbRow[];
  totals: SabudbTotals;
}

/** Lines grouped by expense class (UACS major) in report order; classes without lines are left out. */
export function groupByClass(rows: SabudbRow[]): SabudbClassGroup[] {
  return OBJECT_CLASSES.map((c) => {
    const inClass = rows.filter((r) => r.objectClass === c.code);
    return { ...c, shortName: SHORT_NAME[c.code], title: `${c.major} – ${c.name}${c.code === "Others" ? "" : ` (${c.code})`}`, rows: inClass, totals: sumRows(inClass) };
  }).filter((g) => g.rows.length);
}

export interface SabudbDocOptions {
  view: "summary" | "detailed";
  cover: boolean;
  signature: boolean;
  /** Detailed view: class header and subtotal rows (otherwise a flat list of lines). */
  groupByClass: boolean;
  /** Detailed view: adds the Summary by Object of Expenditure table. */
  groupByObject: boolean;
  previousYear: boolean;
  notes: boolean;
}

export const SABUDB_NOTES = [
  "Utilizations equal obligations incurred against the approved budget.",
  "Balance = approved budget less utilizations; % utilization = utilizations ÷ approved budget.",
  "Allotments, obligations, utilizations and disbursements are cumulative as of the end of the quarter; the approved budget is for the whole fiscal year.",
  "Illustrative sample values for demonstration/UAT only; not actual MPC financial records.",
];

const QUARTER_TEXT: Record<string, string> = { Q1: "1st Quarter", Q2: "2nd Quarter", Q3: "3rd Quarter", Q4: "4th Quarter" };
const peso = (v: number) => (v === 0 ? "-" : formatCurrency(v).replace("₱", ""));
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const amounts = (t: SabudbTotals) => [peso(t.gaaOriginal), peso(t.supplemental), peso(approvedBudget(t)), peso(t.allotments), peso(t.obligations), peso(t.disbursements), peso(utilizations(t)), peso(balanceOf(t)), pct(utilizationRate(t))];
const amountCells = (t: SabudbTotals) => amounts(t).map((v) => `<td class="n">${v}</td>`).join("");

/** Printable SABUDB report (HTML pages), used for the preview, PDF (print) and download. */
export function buildSabudbDocument(report: SabudbReport, opts: SabudbDocOptions, labels: SaaodbFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const groups = groupByClass(report.rows);
  const grand = sumRows(report.rows);
  const detailed = opts.view === "detailed";
  const pages: string[] = [];
  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 6<br/>(SABUDB)<br/><span>Annex F</span></div></div>`;
  const title = `<h1>${SABUDB_TITLE.toUpperCase()}</h1><p class="asof">As of ${esc(longDate(report.asOf))}<br/>(${QUARTER_TEXT[report.quarter]})</p>`;
  const params = `<table class="params"><tr><td>Department/Office</td><td>: ${esc(labels.department)}</td></tr><tr><td>Allotment Class</td><td>: ${esc(labels.allotmentClass)}</td></tr><tr><td>UACS (Major)</td><td>: ${esc(labels.uacsMajor)}</td></tr></table>`;
  const head = `<thead><tr><th rowspan="2" class="code">UACS<br/>Code</th><th rowspan="2">Object of Expenditure</th><th colspan="3">Approved Budget (₱)</th><th rowspan="2">Allotments<br/>(₱)</th><th rowspan="2">Obligations<br/>(₱)</th><th rowspan="2">Disbursements<br/>(₱)</th><th rowspan="2">Utilizations<br/>(₱)</th><th rowspan="2">Balance<br/>(₱)</th><th rowspan="2">% Utilization</th></tr><tr><th>GAA/Original</th><th>Supplemental</th><th>Total</th></tr></thead>`;
  const grandRow = `<tfoot><tr><td colspan="2" class="c">GRAND TOTAL</td>${amountCells(grand)}</tr></tfoot>`;
  const empty = `<tbody><tr><td colspan="11">No records match the selected parameters.</td></tr></tbody>`;
  const lineRow = (r: SabudbRow, no = "") => `<tr><td class="c">${no}</td><td class="ind">${esc(r.uacsCode)} – ${esc(r.objectOfExpenditure)}</td>${amountCells(r)}</tr>`;

  let body: string;
  if (!groups.length) body = empty;
  else if (!detailed) body = `<tbody>${groups.map((g) => `<tr><td class="c">${g.major}</td><td>${esc(g.name)}</td>${amountCells(g.totals)}</tr>`).join("")}</tbody>${grandRow}`;
  else if (opts.groupByClass)
    body = `<tbody>${groups
      .map((g, i) => `<tr class="grp"><td class="c">${i + 1}</td><td colspan="10">${esc(g.title)}</td></tr>${g.rows.map((r) => lineRow(r)).join("")}<tr class="sub"><td></td><td class="r">Total – ${esc(g.shortName)}</td>${amountCells(g.totals)}</tr>`)
      .join("")}</tbody>${grandRow}`;
  else body = `<tbody>${groups.flatMap((g) => g.rows).map((r, i) => lineRow(r, String(i + 1))).join("")}</tbody>${grandRow}`;

  const signatures = opts.signature
    ? `<div class="sigs">${report.signatories
        .map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`)
        .join("")}</div>`
    : "";

  if (opts.cover) {
    pages.push(`${header}<div class="cover"><h2>BFARS 6</h2><h1>${SABUDB_TITLE.toUpperCase()} (SABUDB)</h1><p class="big">Fiscal Year ${report.fiscalYear}<br/>${QUARTER_TEXT[report.quarter]}</p><p>As of ${esc(longDate(report.asOf))}</p><p>${esc(report.fundSource)}</p></div><div class="prep">Prepared by:<br/><b>Budget Office</b><br/>${esc(report.agency)}</div>`);
  }
  pages.push(`${header}${title}${params}<table class="stmt">${head}${body}</table>${signatures}`);

  // Supplementary tables share one page after the statement.
  const extra: string[] = [];
  if (detailed && opts.groupByObject && groups.length) {
    const summaryBody = `<tbody>${groups.map((g) => `<tr><td class="c">${g.major}</td><td>${esc(g.name)}</td>${amountCells(g.totals)}</tr>`).join("")}</tbody>${grandRow}`;
    extra.push(`<h3>Summary by Object of Expenditure</h3><table class="stmt">${head}${summaryBody}</table>`);
  }
  if (opts.previousYear) {
    if (!report.previous) extra.push(`<h3>Comparison with the Previous Fiscal Year</h3><p>No data is available for FY ${report.fiscalYear - 1}.</p>`);
    else {
      const prev = groupByClass(report.previous.rows);
      const py = report.previous.fiscalYear;
      const cy = report.fiscalYear;
      const rows = OBJECT_CLASSES.map((c) => ({ c, cur: groups.find((g) => g.code === c.code)?.totals, old: prev.find((g) => g.code === c.code)?.totals })).filter((x) => x.cur || x.old);
      const zero = sumRows([]);
      const cmp = (cur: SabudbTotals, old: SabudbTotals) => [approvedBudget(old), approvedBudget(cur), utilizations(old), utilizations(cur)].map((v) => `<td class="n">${peso(v)}</td>`).join("") + `<td class="n">${pct(utilizationRate(old))}</td><td class="n">${pct(utilizationRate(cur))}</td>`;
      extra.push(
        `<h3>Comparison with the Previous Fiscal Year (${QUARTER_TEXT[report.quarter]})</h3><table class="stmt"><thead><tr><th rowspan="2" class="code">UACS<br/>Code</th><th rowspan="2">Object of Expenditure</th><th colspan="2">Approved Budget (₱)</th><th colspan="2">Utilizations (₱)</th><th colspan="2">% Utilization</th></tr><tr><th>FY ${py}</th><th>FY ${cy}</th><th>FY ${py}</th><th>FY ${cy}</th><th>FY ${py}</th><th>FY ${cy}</th></tr></thead><tbody>${rows
          .map((x) => `<tr><td class="c">${x.c.major}</td><td>${esc(x.c.name)}</td>${cmp(x.cur ?? zero, x.old ?? zero)}</tr>`)
          .join("")}</tbody><tfoot><tr><td colspan="2" class="c">GRAND TOTAL</td>${cmp(grand, sumRows(report.previous.rows))}</tr></tfoot></table>`,
      );
    }
  }
  if (opts.notes) extra.push(`<h3>Notes/Remarks</h3><ol class="notes"><li>Fund source: ${esc(report.fundSource)}.</li>${SABUDB_NOTES.map((n) => `<li>${esc(n)}</li>`).join("")}</ol>`);
  if (extra.length) pages.push(`${header}${extra.join("")}`);

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 6 – SABUDB FY ${report.fiscalYear} ${report.quarter}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:7mm 10mm 12mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:110px 1fr 110px;align-items:start;gap:10px}.hdr img{width:50px;height:50px;object-fit:contain;margin-left:20px}.org{text-align:center;font-size:10.5px;line-height:1.35}.org b{font-size:11.5px}.form{text-align:right;font-weight:bold;font-size:11px;line-height:1.4}.form span{font-weight:normal}
h1{text-align:center;font-size:11.5px;margin:2px 40px 1px;line-height:1.3}.asof{text-align:center;margin:0 0 4px;font-size:10.5px;line-height:1.3}h2{font-size:40px;margin:0;color:#1e3a8a}h3{font-size:11.5px;color:#1e3a8a;margin:8px 0 4px}
.params{width:auto;margin-bottom:5px}.params td{border:0;padding:0 6px 0 0;font-size:9px}.params td:first-child{font-weight:bold;width:100px}
table{width:100%;border-collapse:collapse;margin-bottom:5px}th,td{border:1px solid #94a3b8;padding:2px 4px;text-align:left}th{background:#dbeafe;font-size:8.5px;text-align:center;line-height:1.2}th.code{width:44px}
td.n{text-align:right;white-space:nowrap;width:8.4%}td.ind{padding-left:10px}td.c{text-align:center}td.r{text-align:right;font-weight:bold}
tr.grp td{font-weight:bold}tr.sub td{font-weight:bold;background:#e0ecfb}tfoot td{font-weight:bold;background:#bfdbfe}
.notes{margin:0;padding-left:18px;font-size:10px;line-height:1.6}
.cover{text-align:center;margin-top:22mm;color:#1e3a8a}.cover h1{margin:10px 40mm;font-size:15px}.cover .big{font-size:16px;font-weight:bold;color:#111827;margin-top:18px}.prep{position:absolute;left:0;right:0;bottom:24mm;text-align:center;font-size:11px}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:6px}.sigs p{margin:0}.sigs .line{border-bottom:1px solid #111;height:20px;margin:0 20px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin-top:5px}.sigs i{display:inline-block;width:60%;border-bottom:1px solid #111}
footer{position:absolute;left:10mm;right:10mm;bottom:5mm;display:flex;justify-content:space-between;color:#6b7280;font-size:8px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((p, i) => `<section class="page" id="page-${i + 1}">${p}<footer>${esc(report.agency)} • BFARS 6 – SABUDB • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

const AMOUNT_HEAD = ["Approved Budget – GAA/Original", "Approved Budget – Supplemental", "Approved Budget – Total", "Allotments", "Obligations", "Disbursements", "Utilizations", "Balance", "% Utilization"];
const vals = (t: SabudbTotals): XlsxCell[] => [t.gaaOriginal, t.supplemental, approvedBudget(t), t.allotments, t.obligations, t.disbursements, utilizations(t), balanceOf(t), Number(utilizationRate(t).toFixed(4))];

/** Workbook sheets for XLSX / XLS export, following the same options as the printed report. */
export function buildSabudbSheets(report: SabudbReport, opts: SabudbDocOptions, labels: SaaodbFilterLabels): XlsxSheet[] {
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 6 – ${title}`],
    [`${report.agency} • ${report.period} • As of ${longDate(report.asOf)}`],
    [`Department/Office: ${labels.department} • Allotment Class: ${labels.allotmentClass} • UACS (Major): ${labels.uacsMajor}`],
    [],
  ];
  const widths = [12, 46, 20, 18, 20, 18, 18, 18, 18, 18, 14];
  const groups = groupByClass(report.rows);
  const grand = sumRows(report.rows);
  const summaryRows = (): XlsxCell[][] => groups.map((g) => [g.major, g.name, ...vals(g.totals)]);
  const sheets: XlsxSheet[] = [];

  if (opts.view === "detailed") {
    const rows: XlsxCell[][] = [...intro(SABUDB_TITLE), ["UACS Code", "Object of Expenditure", ...AMOUNT_HEAD]];
    const bold = [0, 4];
    groups.forEach((g) => {
      if (opts.groupByClass) {
        bold.push(rows.length);
        rows.push([g.major, g.title]);
      }
      g.rows.forEach((r) => rows.push([r.uacsCode, r.objectOfExpenditure, ...vals(r)]));
      if (opts.groupByClass) {
        bold.push(rows.length);
        rows.push(["", `Total – ${g.shortName}`, ...vals(g.totals)]);
      }
    });
    bold.push(rows.length);
    rows.push(["GRAND TOTAL", "", ...vals(grand)]);
    sheets.push({ name: "SABUDB Detail", rows, boldRows: bold, columnWidths: widths });
  }
  if (opts.view === "summary" || opts.groupByObject) {
    const rows: XlsxCell[][] = [...intro(opts.view === "summary" ? SABUDB_TITLE : "Summary by Object of Expenditure"), ["UACS Major", "Object of Expenditure", ...AMOUNT_HEAD], ...summaryRows(), ["GRAND TOTAL", "", ...vals(grand)]];
    sheets.push({ name: "SABUDB Summary", rows, boldRows: [0, 4, rows.length - 1], columnWidths: widths });
  }
  if (opts.previousYear && report.previous) {
    const py = report.previous.fiscalYear;
    const cy = report.fiscalYear;
    const prev = groupByClass(report.previous.rows);
    const zero = sumRows([]);
    const cmp = (cur: SabudbTotals, old: SabudbTotals): XlsxCell[] => [approvedBudget(old), approvedBudget(cur), utilizations(old), utilizations(cur), Number(utilizationRate(old).toFixed(4)), Number(utilizationRate(cur).toFixed(4))];
    const rows: XlsxCell[][] = [
      ...intro("Comparison with the Previous Fiscal Year"),
      ["UACS Major", "Object of Expenditure", `Approved Budget FY ${py}`, `Approved Budget FY ${cy}`, `Utilizations FY ${py}`, `Utilizations FY ${cy}`, `% Utilization FY ${py}`, `% Utilization FY ${cy}`],
      ...OBJECT_CLASSES.map((c) => ({ c, cur: groups.find((g) => g.code === c.code)?.totals, old: prev.find((g) => g.code === c.code)?.totals }))
        .filter((x) => x.cur || x.old)
        .map((x) => [x.c.major, x.c.name, ...cmp(x.cur ?? zero, x.old ?? zero)]),
      ["GRAND TOTAL", "", ...cmp(grand, sumRows(report.previous.rows))],
    ];
    sheets.push({ name: "Previous Year", rows, boldRows: [0, 4, rows.length - 1], columnWidths: widths });
  }
  if (opts.notes) {
    sheets.push({ name: "Notes", rows: [["Notes/Remarks"], [`Fund source: ${report.fundSource}.`], ...SABUDB_NOTES.map((n) => [n])], boldRows: [0], columnWidths: [120] });
  }
  return sheets;
}

export const sabudbFileName = (report: SabudbReport, ext: string) => `MPC_BFARS6_SABUDB_FY${report.fiscalYear}_${report.quarter}.${ext}`;
