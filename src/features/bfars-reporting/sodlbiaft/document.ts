import { formatCurrency, formatDate, formatPercent, safeRatio } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import type { SodlbiaftReport, SodlbiaftRow } from "./types";

/** Balance = funds received − obligations (the dashboard's "Available Balance": ₱120M − ₱90M = ₱30M). */
export const balanceOf = (r: Pick<SodlbiaftTotals, "fundsReceived" | "obligations">) => r.fundsReceived - r.obligations;
/** % Utilization = obligations ÷ funds received (75.00% in the mockup). */
export const utilizationOf = (r: Pick<SodlbiaftTotals, "fundsReceived" | "obligations">) => safeRatio(r.obligations, r.fundsReceived);

/** Date as in the BFARS 5 mockups, e.g. "Jan 10, 2026". */
export const sodlbiaftDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

export interface SodlbiaftTotals {
  count: number;
  fundsReceived: number;
  obligations: number;
  disbursements: number;
  liquidations: number;
}
export const sumRows = (rows: SodlbiaftRow[]): SodlbiaftTotals =>
  rows.reduce(
    (t, r) => ({
      count: t.count + 1,
      fundsReceived: t.fundsReceived + r.fundsReceived,
      obligations: t.obligations + r.obligations,
      disbursements: t.disbursements + r.disbursements,
      liquidations: t.liquidations + r.liquidations,
    }),
    { count: 0, fundsReceived: 0, obligations: 0, disbursements: 0, liquidations: 0 },
  );

export interface SodlbiaftGroup {
  key: string;
  title: string;
  rows: SodlbiaftRow[];
  totals: SodlbiaftTotals;
}

/** Per source agency, in report order (agencies without transfers are left out). */
export function groupByAgency(rows: SodlbiaftRow[], agencies: SodlbiaftReport["options"]["sourceAgencies"]): SodlbiaftGroup[] {
  return agencies
    .map((a) => {
      const inGroup = rows.filter((r) => r.sourceAgency === a.code);
      return { key: a.code, title: a.code === "Others" ? `Others (${a.name})` : `${a.name} (${a.code})`, rows: inGroup, totals: sumRows(inGroup) };
    })
    .filter((g) => g.rows.length);
}

/** Per program/project category, in chart order (categories without transfers are left out). */
export function groupByProgram(rows: SodlbiaftRow[], programs: string[]): SodlbiaftGroup[] {
  return programs
    .map((p) => {
      const inGroup = rows.filter((r) => r.program === p);
      return { key: p, title: p, rows: inGroup, totals: sumRows(inGroup) };
    })
    .filter((g) => g.rows.length);
}

export interface SodlbiaftDocOptions {
  cover: boolean;
  summary: boolean;
  details: boolean;
  groupByAgency: boolean;
  groupByProgram: boolean;
  signature: boolean;
}

export interface SodlbiaftFilterLabels {
  office: string;
  sourceAgency: string;
  program: string;
}

export const SODLBIAFT_TITLE = "Statement of Obligations, Disbursements, Liquidations and Balances from Inter-Agency Fund Transfers (SODLBIAFT)";
const QUARTER_TEXT: Record<string, string> = { Q1: "1st Quarter", Q2: "2nd Quarter", Q3: "3rd Quarter", Q4: "4th Quarter" };
const peso = (v: number) => formatCurrency(v).replace("₱", "");
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// Lines that fit on a landscape A4 page: the first page also carries the title and parameters.
const FIRST_PAGE_LINES = 28;
const PAGE_LINES = 33;
const SIGNATURE_LINES = 7;

/** Printable BFARS 5 report (HTML pages), used for the preview, PDF (print) and download. */
export function buildSodlbiaftDocument(report: SodlbiaftReport, opts: SodlbiaftDocOptions, labels: SodlbiaftFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const agencies = groupByAgency(report.rows, report.options.sourceAgencies);
  const programs = groupByProgram(report.rows, report.options.programs);
  const grand = sumRows(report.rows);
  const pages: string[] = [];
  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 5<br/>(SODLBIAFT)<br/><span>Annex E</span></div></div>`;
  const title = `<h1>STATEMENT OF OBLIGATIONS, DISBURSEMENTS, LIQUIDATIONS AND BALANCES<br/>FROM INTER-AGENCY FUND TRANSFERS (SODLBIAFT)</h1><p class="asof">As of ${esc(longDate(report.asOf))}<br/>(${QUARTER_TEXT[report.quarter]})</p>`;
  const paramRows: [string, string][] = [
    ["Implementing Office", labels.office],
    ["Source Agency", labels.sourceAgency],
    ["Fund Source", report.fundSource],
    ["Program/Project", labels.program],
  ];
  const params = `<table class="params">${paramRows.map(([k, v]) => `<tr><td>${k}</td><td>:</td><td>${esc(v)}</td></tr>`).join("")}</table>`;
  const amountCells = (t: Omit<SodlbiaftTotals, "count">) => [t.fundsReceived, t.obligations, t.disbursements, t.liquidations, balanceOf(t)].map((v) => `<td class="n">${peso(v)}</td>`).join("");
  const sigBlock = `<div class="sigs">${report.signatories.map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`).join("")}</div>`;

  if (opts.cover) {
    pages.push(`${header}<div class="cover"><h2>BFARS 5</h2><h1>${esc(SODLBIAFT_TITLE.toUpperCase())}</h1><p class="big">Fiscal Year ${report.fiscalYear}<br/>${QUARTER_TEXT[report.quarter]}</p><p>As of ${esc(formatDate(report.asOf))}</p>${params}</div><div class="prep">Prepared by:<br/><b>Budget Office</b><br/>${esc(report.agency)}</div>`);
  }

  // Summary page: totals per source agency and/or per program/project, with utilization.
  if (opts.summary) {
    const sumTable = (label: string, groups: SodlbiaftGroup[]) =>
      `<h3>Summary by ${label}</h3><table class="sum"><thead><tr><th>${label}</th><th>No. of Transfers</th><th>Funds Received (₱)</th><th>Obligations (₱)</th><th>Disbursements (₱)</th><th>Liquidations (₱)</th><th>Balance (₱)</th><th>% Utilization</th></tr></thead><tbody>${
        groups.map((g) => `<tr><td>${esc(g.title)}</td><td class="c">${g.totals.count}</td>${amountCells(g.totals)}<td class="c">${formatPercent(utilizationOf(g.totals), 2)}</td></tr>`).join("") ||
        `<tr><td colspan="8" class="c">No records match the selected parameters.</td></tr>`
      }</tbody><tfoot><tr><td class="c">TOTAL</td><td class="c">${grand.count}</td>${amountCells(grand)}<td class="c">${formatPercent(utilizationOf(grand), 2)}</td></tr></tfoot></table>`;
    const kpis = (
      [
        ["Total Funds Received", grand.fundsReceived],
        ["Total Obligations", grand.obligations],
        ["Total Disbursements", grand.disbursements],
        ["Total Liquidations", grand.liquidations],
        ["Available Balance", balanceOf(grand)],
      ] as const
    )
      .map(([k, v]) => `<div><span>${k}</span><b>₱ ${peso(v)}</b><em>${formatPercent(safeRatio(v, grand.fundsReceived), 2)} of funds received</em></div>`)
      .join("");
    const tables = [opts.groupByAgency || !opts.groupByProgram ? sumTable("Source Agency", agencies) : "", opts.groupByProgram ? sumTable("Program/Project", programs) : ""].join("");
    pages.push(`${header}<h3 class="sec">Summary – ${esc(report.period)}</h3><div class="kpis">${kpis}</div>${tables}`);
  }

  // Detailed listing, grouped by source agency (as in the mockup) or by program/project.
  let room = 0;
  if (opts.details) {
    const heads = ["#", "Source Agency", "Program/Project", "Implementing Office", "Reference No.", "Date Received", "Funds Received (₱)", "Obligations (₱)", "Disbursements (₱)", "Liquidations (₱)", "Balance (₱)"];
    const thead = `<thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
    const lines: string[] = [];
    const tail = (r: SodlbiaftRow) => `<td>${esc(r.office)}</td><td>${esc(r.referenceNo)}</td><td>${esc(sodlbiaftDate(r.dateReceived))}</td>${amountCells(r)}`;
    const groups = opts.groupByAgency ? agencies : opts.groupByProgram ? programs : null;
    if (groups) {
      groups.forEach((g, gi) => {
        lines.push(`<tr class="grp"><td class="c">${gi + 1}</td><td colspan="10">${esc(g.title)}</td></tr>`);
        g.rows.forEach((r, i) =>
          lines.push(
            opts.groupByAgency
              ? `<tr><td class="c">${gi + 1}.${i + 1}</td><td colspan="2">${esc(r.project)}</td>${tail(r)}</tr>`
              : `<tr><td class="c">${gi + 1}.${i + 1}</td><td>${esc(r.sourceAgency)}</td><td>${esc(r.project)}</td>${tail(r)}</tr>`,
          ),
        );
        lines.push(`<tr class="sub"><td colspan="6">Total – ${esc(g.key)}</td>${amountCells(g.totals)}</tr>`);
      });
    } else {
      report.rows.forEach((r, i) => lines.push(`<tr><td class="c">${i + 1}</td><td>${esc(r.sourceAgency)}</td><td>${esc(r.project)}</td>${tail(r)}</tr>`));
    }
    if (!report.rows.length) lines.push(`<tr><td colspan="${heads.length}" class="c">No records match the selected parameters.</td></tr>`);
    lines.push(`<tr class="total"><td colspan="6">GRAND TOTAL</td>${amountCells(grand)}</tr>`);

    let start = 0;
    for (let p = 0; start < lines.length; p++) {
      const cap = p === 0 ? FIRST_PAGE_LINES : PAGE_LINES;
      const chunk = lines.slice(start, start + cap);
      start += cap;
      room = cap - chunk.length;
      pages.push(`${header}${p === 0 ? title + params : `<h3>${esc(SODLBIAFT_TITLE)} (continued)</h3>`}<table class="detail">${thead}<tbody>${chunk.join("")}</tbody></table>`);
    }
  }

  // Signatures follow the listing on its last page when they fit (as in the mockup), else on their own page.
  if (opts.signature) {
    if (opts.details && room >= SIGNATURE_LINES) pages[pages.length - 1] += sigBlock;
    else pages.push(`${header}${title}${params}<p class="cert">The figures in this report are generated from eBudget for FY ${report.fiscalYear}, ${QUARTER_TEXT[report.quarter]}.</p>${sigBlock}`);
  }
  if (!pages.length) pages.push(`${header}${title}${params}<p>No sections selected.</p>`);

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 5 – SODLBIAFT FY ${report.fiscalYear} ${report.quarter}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9.5px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:9mm 11mm 15mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:70px 1fr 120px;align-items:center;gap:10px;margin-bottom:4px}.hdr img{width:56px;height:56px;object-fit:contain}.org{text-align:center;font-size:11px;line-height:1.35}.org b{font-size:13px}.form{text-align:right;font-weight:bold;font-size:12px;line-height:1.3}.form span{font-weight:normal}
h1{text-align:center;font-size:12.5px;margin:4px 40px 2px;line-height:1.35}.asof{text-align:center;margin:0 0 6px;font-size:11px;line-height:1.35}h2{font-size:40px;margin:0;color:#1e3a8a}h3{font-size:12px;color:#1e3a8a;margin:8px 0 4px}h3.sec{font-size:13px;margin-top:4px}
.params{width:auto;border-collapse:collapse;margin-bottom:6px}.params td{border:0;padding:1px 6px 1px 0;font-size:10px}.params td:first-child{font-weight:bold;width:110px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #94a3b8;padding:3px 4px;text-align:left;vertical-align:middle}th{background:#dbeafe;font-size:9px;text-align:center}td.n{text-align:right;white-space:nowrap}td.c{text-align:center}
.detail td{white-space:nowrap}tr.grp td{font-weight:bold;background:#f1f5f9}tr.sub td{font-weight:bold;background:#eff6ff}tr.sub td:first-child,tr.total td:first-child{text-align:center}tr.total td{font-weight:bold;background:#bfdbfe}tfoot td{font-weight:bold;background:#bfdbfe}
.sum{margin-bottom:8px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:4px 0 8px}.kpis div{border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px}.kpis span,.kpis em{display:block;color:#4b5563;font-size:9px;font-style:normal}.kpis b{display:block;font-size:13px;margin:2px 0}
.cover{text-align:center;margin-top:16mm;color:#1e3a8a}.cover h1{margin:10px 30mm}.cover .big{font-size:16px;font-weight:bold;color:#111827;margin-top:18px}.cover .params{margin:14px auto 0;color:#111827;text-align:left}.prep{position:absolute;left:0;right:0;bottom:24mm;text-align:center;font-size:11px}
.cert{margin:10px 0 0;font-size:10px}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:14px}.sigs .line{border-bottom:1px solid #111;height:24px;margin:0 20px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin-top:8px}.sigs .date i{display:inline-block;width:120px;border-bottom:1px solid #111}
footer{position:absolute;left:11mm;right:11mm;bottom:6mm;display:flex;justify-content:space-between;color:#6b7280;font-size:8px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((p, i) => `<section class="page" id="page-${i + 1}">${p}<footer>${esc(report.agency)} • BFARS 5 – SODLBIAFT • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets (detail listing, agency and program summaries) for XLSX / XLS export. */
export function buildSodlbiaftSheets(report: SodlbiaftReport, opts: SodlbiaftDocOptions, labels: SodlbiaftFilterLabels): XlsxSheet[] {
  const amountHeads = ["Funds Received", "Obligations", "Disbursements", "Liquidations", "Balance"];
  const amounts = (t: Omit<SodlbiaftTotals, "count">): XlsxCell[] => [t.fundsReceived, t.obligations, t.disbursements, t.liquidations, balanceOf(t)];
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 5 – ${title}`],
    [`${report.agency} • ${report.period} • As of ${formatDate(report.asOf)}`],
    [`Implementing Office: ${labels.office} • Source Agency: ${labels.sourceAgency} • Fund Source: ${report.fundSource} • Program/Project: ${labels.program}`],
    [],
  ];
  const agencies = groupByAgency(report.rows, report.options.sourceAgencies);
  const programs = groupByProgram(report.rows, report.options.programs);
  const grand = sumRows(report.rows);
  const pad = (k: number) => Array<XlsxCell>(k).fill("");
  const sheets: XlsxSheet[] = [];

  if (opts.details || !opts.summary) {
    const head = ["#", "Source Agency", "Program/Project", "Category", "Implementing Office", "Reference No.", "Date Received", ...amountHeads, "% Utilization", "Status"];
    const rows: XlsxCell[][] = [...intro(SODLBIAFT_TITLE), head];
    const bold = [0, 4];
    const line = (n: string | number, r: SodlbiaftRow): XlsxCell[] => [n, r.sourceAgency, r.project, r.program, r.office, r.referenceNo, sodlbiaftDate(r.dateReceived), ...amounts(r), Number(utilizationOf(r).toFixed(4)), r.status];
    const groups = opts.groupByAgency ? agencies : opts.groupByProgram ? programs : null;
    if (groups) {
      groups.forEach((g, gi) => {
        bold.push(rows.length);
        rows.push([gi + 1, g.title]);
        g.rows.forEach((r, i) => rows.push(line(`${gi + 1}.${i + 1}`, r)));
        bold.push(rows.length);
        rows.push([`Total – ${g.key}`, ...pad(6), ...amounts(g.totals), Number(utilizationOf(g.totals).toFixed(4))]);
      });
    } else report.rows.forEach((r, i) => rows.push(line(i + 1, r)));
    bold.push(rows.length);
    rows.push(["GRAND TOTAL", ...pad(6), ...amounts(grand), Number(utilizationOf(grand).toFixed(4))]);
    sheets.push({ name: "SODLBIAFT Detail", rows, boldRows: bold, columnWidths: [8, 14, 30, 26, 22, 16, 14, 18, 18, 18, 18, 18, 13, 16] });
  }

  if (opts.summary) {
    const summary = (name: string, label: string, groups: SodlbiaftGroup[]) => {
      const rows: XlsxCell[][] = [
        ...intro(`Summary by ${label}`),
        [label, "No. of Transfers", ...amountHeads, "% Utilization"],
        ...groups.map((g) => [g.title, g.totals.count, ...amounts(g.totals), Number(utilizationOf(g.totals).toFixed(4))]),
        ["TOTAL", grand.count, ...amounts(grand), Number(utilizationOf(grand).toFixed(4))],
      ];
      sheets.push({ name, rows, boldRows: [0, 4, rows.length - 1], columnWidths: [40, 16, 18, 18, 18, 18, 18, 13] });
    };
    if (opts.groupByAgency || !opts.groupByProgram) summary("Agency Summary", "Source Agency", agencies);
    if (opts.groupByProgram) summary("Program Summary", "Program/Project", programs);
  }
  return sheets;
}

export const sodlbiaftFileName = (report: SodlbiaftReport, ext: string) => `MPC_BFARS5_SODLBIAFT_FY${report.fiscalYear}_${report.quarter}.${ext}`;
