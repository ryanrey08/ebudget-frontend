import { formatCurrency } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import type { SaaodbFilterLabels } from "../saaodb/document";
import { approvedBudget, balanceOf, sumRows, utilizationRate, utilizations, type SabudbTotals } from "../sabudb/document";
import { OBJECT_CLASSES, longDate } from "../saaodboe/document";
import type { ObjectClass } from "../saaodboe/types";
import type { SabudboeReport, SabudboeRow } from "./types";

// Same formulas as BFARS 6, confirmed by the BFARS 7 sample workbook: available balance = approved budget − utilizations,
// utilization % = utilizations ÷ approved budget, utilizations = obligations.
export { approvedBudget, balanceOf, sumRows, utilizationRate, utilizations };
export type { SabudbTotals };

export const SABUDBOE_TITLE = "Summary of Approved Budget, Utilizations, Disbursements and Balances by Object of Expenditures";
export const SABUDBOE_FOOTNOTE = "All amounts in Philippine pesos (PHP). Available Balance = Approved Budget less Utilizations. Utilization % = Utilizations / Approved Budget.";

/** Subtotal labels as in the report mockup ("Total – MOOE"). */
const SUBTOTAL_NAME: Record<ObjectClass, string> = { PS: "Personnel Services (PS)", MOOE: "MOOE", CO: "CO", FE: "FE", Others: "Others" };
/** Chart labels as in the dashboard mockup. */
const SHORT_NAME: Record<ObjectClass, string> = { PS: "Personnel Services", MOOE: "MOOE", CO: "Capital Outlay", FE: "Financial Expenses", Others: "Others" };
const ROMAN = ["I", "II", "III", "IV", "V"];

export interface SabudboeLine extends SabudbTotals {
  uacsCode: string;
  objectOfExpenditure: string;
  /** The line split by MFO/PAP (Detailed view). */
  paps: { mfoPap: string; totals: SabudbTotals }[];
}

export interface SabudboeClassGroup {
  code: ObjectClass;
  major: string;
  /** "5-01", as the dashboard shows the UACS major. */
  dashedCode: string;
  /** "Personnel Services (PS)" */
  name: string;
  shortName: string;
  color: string;
  lines: SabudboeLine[];
  totals: SabudbTotals;
}

/** Sums rows by key, keeping the order in which keys first appear. */
function rollUp<T extends SabudbTotals>(rows: T[], key: (r: T) => string): { key: string; rows: T[]; totals: SabudbTotals }[] {
  const map = new Map<string, T[]>();
  rows.forEach((r) => map.set(key(r), [...(map.get(key(r)) ?? []), r]));
  return [...map].map(([k, rs]) => ({ key: k, rows: rs, totals: sumRows(rs) }));
}

/** Rows rolled up by object class (UACS major) and object code, in report order; empty classes are left out. */
export function groupByClass(rows: SabudboeRow[]): SabudboeClassGroup[] {
  return OBJECT_CLASSES.map((c) => {
    const inClass = rows.filter((r) => r.objectClass === c.code);
    const lines = rollUp(inClass, (r) => r.uacsCode).map(({ rows: rs, totals }) => ({
      ...totals,
      uacsCode: rs[0].uacsCode,
      objectOfExpenditure: rs[0].objectOfExpenditure,
      paps: rollUp(rs, (r) => r.mfoPap)
        .map((p) => ({ mfoPap: p.key, totals: p.totals }))
        .sort((a, b) => a.mfoPap.localeCompare(b.mfoPap)),
    }));
    return {
      code: c.code,
      major: c.major,
      dashedCode: `${c.major[0]}-${c.major.slice(1)}`,
      name: c.code === "Others" ? c.name : `${c.name} (${c.code})`,
      shortName: SHORT_NAME[c.code],
      color: c.color,
      lines,
      totals: sumRows(inClass),
    };
  }).filter((g) => g.lines.length);
}

/** Totals per allotment class, in the app's class order. */
export const byAllotmentClass = (rows: SabudboeRow[]) =>
  ["RAOPS", "RAOMO", "RAOCO", "RAOFE"].map((c) => ({ name: c, rows: rows.filter((r) => r.allotmentClass === c) }))
    .filter((x) => x.rows.length)
    .map((x) => ({ name: x.name, totals: sumRows(x.rows) }));

export interface SabudboeDocOptions {
  /** summary = object-of-expenditure lines (as in the mockup); detailed = each line split by MFO/PAP. */
  view: "summary" | "detailed";
  cover: boolean;
  signature: boolean;
  previousYear: boolean;
  /** Adds the Breakdown by Allotment Class table. */
  classBreakdown: boolean;
  /** Groups the statement by department/office, with an office total for each. */
  groupByOffice: boolean;
  showUtilization: boolean;
}

const QUARTER_TEXT: Record<string, string> = { Q1: "1st Quarter", Q2: "2nd Quarter", Q3: "3rd Quarter", Q4: "4th Quarter" };
const peso = (v: number) => (Math.abs(v) < 0.005 ? "-" : formatCurrency(v).replace("₱", ""));
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Statement rows that fit on one A4-landscape page with the header, parameters and table head. */
const ROWS_PER_PAGE = 30;
/** Rows' worth of space the signature block needs under the table. */
const SIGNATURE_ROWS = 6;

/** Splits body rows into pages, keeping room for the signatures on the last page. */
function paginate(rows: string[], reserve: number): string[][] {
  const pages: string[][] = [];
  let i = 0;
  for (;;) {
    const rest = rows.length - i;
    if (rest + reserve <= ROWS_PER_PAGE) {
      pages.push(rows.slice(i));
      return pages;
    }
    // Carry at least one row over so the signatures never sit on a page of their own.
    const take = Math.max(1, Math.min(ROWS_PER_PAGE, rest - 1));
    pages.push(rows.slice(i, i + take));
    i += take;
  }
}

/** Printable SABUDBOE report (HTML pages), used for the preview, PDF (print) and download. */
export function buildSabudboeDocument(report: SabudboeReport, opts: SabudboeDocOptions, labels: SaaodbFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const showPct = opts.showUtilization;
  const cols = showPct ? 10 : 9;
  const amountCells = (t: SabudbTotals) =>
    [peso(t.gaaOriginal), peso(t.supplemental), peso(approvedBudget(t)), peso(t.allotments), peso(utilizations(t)), peso(t.disbursements), peso(balanceOf(t)), ...(showPct ? [pct(utilizationRate(t))] : [])]
      .map((v) => `<td class="n">${v}</td>`)
      .join("");

  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 7<br/>(SABUDBOE)<br/><span>Annex G</span></div></div>`;
  const title = `<h1>SUMMARY OF APPROVED BUDGET, UTILIZATIONS, DISBURSEMENTS AND BALANCES<br/>BY OBJECT OF EXPENDITURES (SABUDBOE)</h1><p class="asof">As of ${esc(longDate(report.asOf))}<br/>(${QUARTER_TEXT[report.quarter]})</p>`;
  const params = `<table class="params"><tr><td>Department/Office</td><td>: ${esc(labels.department)}</td></tr><tr><td>Allotment Class</td><td>: ${esc(labels.allotmentClass)}</td></tr><tr><td>UACS (Major)</td><td>: ${esc(labels.uacsMajor)}</td></tr></table>`;
  const head = `<thead><tr><th rowspan="2" class="code">UACS<br/>Code</th><th rowspan="2" class="obj">Object of Expenditure</th><th colspan="3">Approved Budget (₱)</th><th rowspan="2">Allotments<br/>(₱)</th><th rowspan="2">Obligations /<br/>Utilizations<br/>(₱)</th><th rowspan="2">Disbursements<br/>(₱)</th><th rowspan="2">Balance<br/>(₱)</th>${showPct ? `<th rowspan="2">% Utilization</th>` : ""}</tr><tr><th>GAA/Original</th><th>Supplemental</th><th>Total</th></tr></thead>`;

  // Statement body: (office →) class header, object lines (→ MFO/PAP rows), class subtotal; grand total last.
  const classRows = (rows: SabudboeRow[]) =>
    groupByClass(rows).flatMap((g, i) => [
      `<tr class="grp"><td class="c">${ROMAN[OBJECT_CLASSES.findIndex((c) => c.code === g.code)] ?? i + 1}</td><td colspan="${cols - 1}">${g.major} – ${esc(g.name)}</td></tr>`,
      ...g.lines.flatMap((l) => [
        `<tr${opts.view === "detailed" ? ` class="obj"` : ""}><td class="c">${esc(l.uacsCode)}</td><td>${esc(l.objectOfExpenditure)}</td>${amountCells(l)}</tr>`,
        ...(opts.view === "detailed" ? l.paps.map((p) => `<tr class="pap"><td></td><td class="ind">${esc(p.mfoPap)}</td>${amountCells(p.totals)}</tr>`) : []),
      ]),
      `<tr class="sub"><td></td><td class="r">Total – ${esc(SUBTOTAL_NAME[g.code])}</td>${amountCells(g.totals)}</tr>`,
    ]);
  const body = !report.rows.length
    ? [`<tr><td colspan="${cols}">No records match the selected parameters.</td></tr>`]
    : [
        ...(opts.groupByOffice
          ? [...new Set(report.rows.map((r) => r.office))].sort().flatMap((office) => {
              const rows = report.rows.filter((r) => r.office === office);
              return [`<tr class="off"><td colspan="${cols}">${esc(office)}</td></tr>`, ...classRows(rows), `<tr class="sub off-t"><td></td><td class="r">Total – ${esc(office)}</td>${amountCells(sumRows(rows))}</tr>`];
            })
          : classRows(report.rows)),
        `<tr class="gt"><td colspan="2" class="c">GRAND TOTAL</td>${amountCells(sumRows(report.rows))}</tr>`,
      ];

  const signatures = opts.signature
    ? `<div class="sigs">${report.signatories
        .map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`)
        .join("")}</div>`
    : "";

  const pages: string[] = [];
  if (opts.cover) {
    pages.push(`${header}<div class="cover"><h2>BFARS 7</h2><h1>${SABUDBOE_TITLE.toUpperCase()} (SABUDBOE)</h1><p class="big">Fiscal Year ${report.fiscalYear}<br/>${QUARTER_TEXT[report.quarter]}</p><p>As of ${esc(longDate(report.asOf))}</p><p>${esc(report.fundSource)}</p></div><div class="prep">Prepared by:<br/><b>Budget Office</b><br/>${esc(report.agency)}</div>`);
  }
  const chunks = paginate(body, opts.signature ? SIGNATURE_ROWS : 1);
  chunks.forEach((chunk, i) => {
    const last = i === chunks.length - 1;
    pages.push(`${header}${title}${params}<table class="stmt">${head}<tbody>${chunk.join("")}</tbody></table>${last ? `<p class="fn">${SABUDBOE_FOOTNOTE}</p>${signatures}` : `<p class="fn">Continued on the next page.</p>`}`);
  });

  // Supplementary tables share one page after the statement.
  const extra: string[] = [];
  if (opts.classBreakdown) {
    const groups = byAllotmentClass(report.rows);
    extra.push(
      `<h3>Breakdown by Allotment Class</h3><table class="stmt">${head.replace("UACS<br/>Code", "No.").replace(">Object of Expenditure<", ">Allotment Class<")}<tbody>${
        groups.length ? groups.map((g, i) => `<tr><td class="c">${i + 1}</td><td>${esc(g.name)}</td>${amountCells(g.totals)}</tr>`).join("") : `<tr><td colspan="${cols}">No records match the selected parameters.</td></tr>`
      }<tr class="gt"><td colspan="2" class="c">GRAND TOTAL</td>${amountCells(sumRows(report.rows))}</tr></tbody></table>`,
    );
  }
  if (opts.previousYear) {
    if (!report.previous) extra.push(`<h3>Previous Year Comparison</h3><p>No data is available for FY ${report.fiscalYear - 1}.</p>`);
    else {
      const cur = groupByClass(report.rows);
      const prev = groupByClass(report.previous.rows);
      const py = report.previous.fiscalYear;
      const cy = report.fiscalYear;
      const zero = sumRows([]);
      const cmp = (c: SabudbTotals, o: SabudbTotals) =>
        [approvedBudget(o), approvedBudget(c), utilizations(o), utilizations(c), o.disbursements, c.disbursements].map((v) => `<td class="n">${peso(v)}</td>`).join("") +
        (showPct ? `<td class="n">${pct(utilizationRate(o))}</td><td class="n">${pct(utilizationRate(c))}</td>` : "");
      const lines = OBJECT_CLASSES.map((c) => ({ c, cur: cur.find((g) => g.code === c.code), old: prev.find((g) => g.code === c.code) })).filter((x) => x.cur || x.old);
      extra.push(
        `<h3>Previous Year Comparison (${QUARTER_TEXT[report.quarter]}, FY ${py} vs FY ${cy})</h3><table class="stmt"><thead><tr><th rowspan="2" class="code">UACS<br/>Code</th><th rowspan="2" class="obj">Object of Expenditure</th><th colspan="2">Approved Budget (₱)</th><th colspan="2">Obligations / Utilizations (₱)</th><th colspan="2">Disbursements (₱)</th>${showPct ? `<th colspan="2">% Utilization</th>` : ""}</tr><tr>${`<th>FY ${py}</th><th>FY ${cy}</th>`.repeat(showPct ? 4 : 3)}</tr></thead><tbody>${lines
          .map((x) => `<tr><td class="c">${x.c.major}</td><td>${esc((x.cur ?? x.old)?.name ?? x.c.name)}</td>${cmp(x.cur?.totals ?? zero, x.old?.totals ?? zero)}</tr>`)
          .join("")}<tr class="gt"><td colspan="2" class="c">GRAND TOTAL</td>${cmp(sumRows(report.rows), sumRows(report.previous.rows))}</tr></tbody></table>`,
      );
    }
  }
  if (extra.length) pages.push(`${header}${extra.join("")}<p class="fn">${SABUDBOE_FOOTNOTE}</p>`);

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 7 – SABUDBOE FY ${report.fiscalYear} ${report.quarter}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:7mm 10mm 12mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:110px 1fr 110px;align-items:start;gap:10px}.hdr img{width:50px;height:50px;object-fit:contain;margin-left:20px}.org{text-align:center;font-size:10.5px;line-height:1.35}.org b{font-size:11.5px}.form{text-align:right;font-weight:bold;font-size:11px;line-height:1.4}.form span{font-weight:normal}
h1{text-align:center;font-size:11.5px;margin:2px 40px 1px;line-height:1.3}.asof{text-align:center;margin:0 0 4px;font-size:10.5px;line-height:1.3}h2{font-size:40px;margin:0;color:#1e3a8a}h3{font-size:11.5px;color:#1e3a8a;margin:8px 0 4px}
.params{width:auto;margin-bottom:5px}.params td{border:0;padding:0 6px 0 0;font-size:9px}.params td:first-child{font-weight:bold;width:100px}
table{width:100%;border-collapse:collapse;margin-bottom:4px}th,td{border:1px solid #94a3b8;padding:2px 4px;text-align:left}th{background:#dbeafe;font-size:8.5px;text-align:center;line-height:1.2}th.code{width:52px}th.obj{width:24%}
td.n{text-align:right;white-space:nowrap}td.ind{padding-left:16px;color:#374151}td.c{text-align:center}td.r{text-align:right;font-weight:bold}
tr.grp td{font-weight:bold;background:#f1f5f9}tr.obj td{font-weight:600}tr.pap td{font-size:8.5px}tr.sub td{font-weight:bold;background:#e0ecfb}tr.off td{font-weight:bold;background:#1e3a8a;color:#fff}tr.off-t td{background:#c7d7f5}tr.gt td{font-weight:bold;background:#bfdbfe}
.fn{margin:0 0 4px;font-size:8.5px;color:#374151}
.cover{text-align:center;margin-top:22mm;color:#1e3a8a}.cover h1{margin:10px 40mm;font-size:15px}.cover .big{font-size:16px;font-weight:bold;color:#111827;margin-top:18px}.prep{position:absolute;left:0;right:0;bottom:24mm;text-align:center;font-size:11px}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:6px}.sigs p{margin:0}.sigs .line{border-bottom:1px solid #111;height:20px;margin:0 20px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin-top:5px}.sigs i{display:inline-block;width:60%;border-bottom:1px solid #111}
footer{position:absolute;left:10mm;right:10mm;bottom:5mm;display:flex;justify-content:space-between;color:#6b7280;font-size:8px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((p, i) => `<section class="page" id="page-${i + 1}">${p}<footer>${esc(report.agency)} • BFARS 7 – SABUDBOE • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets for XLSX / XLS export, following the same options as the printed report. */
export function buildSabudboeSheets(report: SabudboeReport, opts: SabudboeDocOptions, labels: SaaodbFilterLabels): XlsxSheet[] {
  const showPct = opts.showUtilization;
  const amountHead = ["Approved Budget – GAA/Original", "Approved Budget – Supplemental", "Approved Budget – Total", "Allotments", "Obligations / Utilizations", "Disbursements", "Balance", ...(showPct ? ["% Utilization"] : [])];
  const vals = (t: SabudbTotals): XlsxCell[] => [t.gaaOriginal, t.supplemental, approvedBudget(t), t.allotments, utilizations(t), t.disbursements, balanceOf(t), ...(showPct ? [Number(utilizationRate(t).toFixed(4))] : [])];
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 7 – ${title}`],
    [`${report.agency} • ${report.period} • As of ${longDate(report.asOf)}`],
    [`Department/Office: ${labels.department} • Allotment Class: ${labels.allotmentClass} • UACS (Major): ${labels.uacsMajor}`],
    [],
  ];
  const widths = [12, 52, 20, 18, 20, 18, 22, 18, 18, 14];
  const grand = sumRows(report.rows);
  const sheets: XlsxSheet[] = [];

  const rows: XlsxCell[][] = [...intro(`${SABUDBOE_TITLE} (SABUDBOE)`), ["UACS Code", "Object of Expenditure", ...amountHead]];
  const bold = [0, 4];
  const addClasses = (subset: SabudboeRow[]) =>
    groupByClass(subset).forEach((g) => {
      bold.push(rows.length);
      rows.push([g.major, g.name]);
      g.lines.forEach((l) => {
        rows.push([l.uacsCode, l.objectOfExpenditure, ...vals(l)]);
        if (opts.view === "detailed") l.paps.forEach((p) => rows.push(["", `    ${p.mfoPap}`, ...vals(p.totals)]));
      });
      bold.push(rows.length);
      rows.push(["", `Total – ${SUBTOTAL_NAME[g.code]}`, ...vals(g.totals)]);
    });
  if (opts.groupByOffice)
    [...new Set(report.rows.map((r) => r.office))].sort().forEach((office) => {
      const subset = report.rows.filter((r) => r.office === office);
      bold.push(rows.length);
      rows.push([office]);
      addClasses(subset);
      bold.push(rows.length);
      rows.push(["", `Total – ${office}`, ...vals(sumRows(subset))]);
    });
  else addClasses(report.rows);
  bold.push(rows.length);
  rows.push(["GRAND TOTAL", "", ...vals(grand)], [], [SABUDBOE_FOOTNOTE]);
  sheets.push({ name: "SABUDBOE", rows, boldRows: bold, columnWidths: widths });

  if (opts.classBreakdown) {
    const r: XlsxCell[][] = [...intro("Breakdown by Allotment Class"), ["No.", "Allotment Class", ...amountHead], ...byAllotmentClass(report.rows).map((g, i) => [i + 1, g.name, ...vals(g.totals)]), ["GRAND TOTAL", "", ...vals(grand)]];
    sheets.push({ name: "By Allotment Class", rows: r, boldRows: [0, 4, r.length - 1], columnWidths: widths });
  }
  if (opts.previousYear && report.previous) {
    const py = report.previous.fiscalYear;
    const cy = report.fiscalYear;
    const cur = groupByClass(report.rows);
    const prev = groupByClass(report.previous.rows);
    const zero = sumRows([]);
    const cmp = (c: SabudbTotals, o: SabudbTotals): XlsxCell[] => [
      approvedBudget(o),
      approvedBudget(c),
      utilizations(o),
      utilizations(c),
      o.disbursements,
      c.disbursements,
      ...(showPct ? [Number(utilizationRate(o).toFixed(4)), Number(utilizationRate(c).toFixed(4))] : []),
    ];
    const r: XlsxCell[][] = [
      ...intro("Previous Year Comparison"),
      ["UACS Code", "Object of Expenditure", `Approved Budget FY ${py}`, `Approved Budget FY ${cy}`, `Utilizations FY ${py}`, `Utilizations FY ${cy}`, `Disbursements FY ${py}`, `Disbursements FY ${cy}`, ...(showPct ? [`% Utilization FY ${py}`, `% Utilization FY ${cy}`] : [])],
      ...OBJECT_CLASSES.map((c) => ({ c, cur: cur.find((g) => g.code === c.code), old: prev.find((g) => g.code === c.code) }))
        .filter((x) => x.cur || x.old)
        .map((x) => [x.c.major, (x.cur ?? x.old)?.name ?? x.c.name, ...cmp(x.cur?.totals ?? zero, x.old?.totals ?? zero)]),
      ["GRAND TOTAL", "", ...cmp(grand, sumRows(report.previous.rows))],
    ];
    sheets.push({ name: "Previous Year", rows: r, boldRows: [0, 4, r.length - 1], columnWidths: widths });
  }
  return sheets;
}

export const sabudboeFileName = (report: SabudboeReport, ext: string) => `MPC_BFARS7_SABUDBOE_FY${report.fiscalYear}_${report.quarter}.${ext}`;
