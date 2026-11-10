import { formatCompactCurrency, formatCurrency, safeRatio } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import { lasaDate } from "../lasa/document";
import type { ObjectClass } from "../saaodboe/types";
import type { MrdReport, MrdRow } from "./types";

export const MRD_TITLE = "Monthly Report of Disbursement (MRD)";
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Report columns (PS, MOOE, CO, FE, Others) with the UACS majors and chart colors of the BFARS 9 mockups. */
export const MRD_OBJECTS: { code: ObjectClass; major: string; uacs: string; name: string; legend: string; color: string }[] = [
  { code: "PS", major: "501", uacs: "5-01-01", name: "Personnel Services (PS)", legend: "Personnel Services (PS)", color: "#2f7cf6" },
  { code: "MOOE", major: "502", uacs: "5-02-01", name: "Maintenance & Other Operating Expenses (MOOE)", legend: "MOOE", color: "#ec2027" },
  { code: "CO", major: "503", uacs: "5-03-01", name: "Capital Outlay (CO)", legend: "Capital Outlay (CO)", color: "#3cb455" },
  { code: "FE", major: "504", uacs: "5-04-01", name: "Financial Expenses (FE)", legend: "Financial Expenses (FE)", color: "#f5b301" },
  { code: "Others", major: "505", uacs: "5-05-01", name: "Others", legend: "Others", color: "#8b2cf5" },
];

export const monthOf = (r: Pick<MrdRow, "date">) => Number(r.date.slice(5, 7));
/** "March 2026" */
export const monthLabel = (fiscalYear: number, month: number) => `${MONTHS[month - 1]} ${fiscalYear}`;
/** "January – March 2026" (or just "January 2026"). */
export const ytdLabel = (fiscalYear: number, month: number) => (month > 1 ? `January – ${MONTHS[month - 1]} ${fiscalYear}` : monthLabel(fiscalYear, 1));

export type MrdTotals = Record<ObjectClass, number> & { total: number; count: number };
const emptyTotals = (): MrdTotals => ({ PS: 0, MOOE: 0, CO: 0, FE: 0, Others: 0, total: 0, count: 0 });

/** Amount per object class, total and number of vouchers. */
export function sumByClass(rows: MrdRow[]): MrdTotals {
  return rows.reduce((t, r) => {
    t[r.objectClass] += r.amount;
    t.total += r.amount;
    t.count += 1;
    return t;
  }, emptyTotals());
}

/** Rows of the selected month, the previous month (same fiscal year), the months before it and the year to date. */
export function splitPeriods(rows: MrdRow[], month: number) {
  return {
    current: rows.filter((r) => monthOf(r) === month),
    previous: rows.filter((r) => monthOf(r) === month - 1),
    prior: rows.filter((r) => monthOf(r) < month),
    ytd: rows.filter((r) => monthOf(r) <= month),
  };
}

/** Amount and share of the total for each object class. */
export const classSummary = (t: MrdTotals) => MRD_OBJECTS.map((o) => ({ ...o, amount: t[o.code], share: safeRatio(t[o.code], t.total) }));

/** Month-over-month change as a ratio, or null when there is nothing to compare with. */
export const changeRatio = (current: number, previous: number) => (previous ? (current - previous) / previous : null);

/** Disbursements per month of the fiscal year, split by object class (the trend chart). */
export function monthlyTrend(rows: MrdRow[]) {
  return MONTHS.map((name, i) => {
    const t = sumByClass(rows.filter((r) => monthOf(r) === i + 1));
    return { month: name.slice(0, 3), monthNo: i + 1, PS: t.PS, MOOE: t.MOOE, CO: t.CO, FE: t.FE, Others: t.Others, total: t.total };
  });
}

/** Rows grouped under their UACS major (object class), in report order. */
export const groupByObject = (rows: MrdRow[]) => MRD_OBJECTS.map((o) => ({ ...o, rows: rows.filter((r) => r.objectClass === o.code) })).filter((g) => g.rows.length);

export interface MrdDocOptions {
  summary: boolean;
  details: boolean;
  groupByUacs: boolean;
  previousMonth: boolean;
  fundSource: boolean;
  signatories: boolean;
}

export interface MrdFilterLabels {
  department: string;
  allotmentClass: string;
  uacsMajor: string;
}

const peso = (v: number) => formatCurrency(v).replace("₱", "");
const dash = (v: number) => (v ? peso(v) : "-");
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const compact = (v: number) => formatCompactCurrency(v).replace("₱", "₱ ");
const pct = (r: number | null) => (r === null ? "–" : `${r >= 0 ? "+" : ""}${(r * 100).toFixed(2)}%`);

/** A 1–2–5 step that keeps the axis to about five ticks. */
function niceStep(max: number) {
  const raw = Math.max(max, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
}

/** Stacked monthly trend (₱ millions); months after the reporting month are drawn faded, as in the mockup. */
function trendSvg(rows: MrdRow[], fiscalYear: number, month: number) {
  const data = monthlyTrend(rows);
  const W = 420, H = 170, left = 34, bottom = 140, top = 10;
  const step = niceStep(Math.max(...data.map((d) => d.total)));
  const max = Math.max(step, Math.ceil(Math.max(...data.map((d) => d.total)) / step) * step);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const slot = (W - left) / 12;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const bars = data
    .map((d, i) => {
      let base = 0;
      const x = left + i * slot + slot * 0.22;
      const w = slot * 0.56;
      const stack = MRD_OBJECTS.map((o) => {
        const v = d[o.code];
        if (!v) return "";
        const rect = `<rect x="${x}" y="${y(base + v)}" width="${w}" height="${y(base) - y(base + v)}" fill="${o.color}"/>`;
        base += v;
        return rect;
      }).join("");
      return `<g opacity="${d.monthNo > month ? 0.3 : 1}">${stack}</g><text x="${x + w / 2}" y="${bottom + 12}" text-anchor="middle" font-size="8" fill="#1e3a8a">${d.month}</text>`;
    })
    .join("");
  const offsets = [0, 98, 140, 222, 316];
  const legend = MRD_OBJECTS.map((o, i) => `<rect x="${left + offsets[i]}" y="${H - 9}" width="7" height="7" fill="${o.color}"/><text x="${left + offsets[i] + 10}" y="${H - 3}" font-size="7.5" fill="#1e3a8a">${esc(o.legend)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="215" role="img" aria-label="Monthly disbursements trend, fiscal year ${fiscalYear}">
${ticks.map((v) => `<line x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e7eb"/><text x="${left - 5}" y="${y(v) + 3}" text-anchor="end" font-size="7.5" fill="#374151">${v ? esc(formatCompactCurrency(v).replace("₱", "")) : "0"}</text>`).join("")}
${bars}${legend}</svg>`;
}

/** Donut of the month's disbursements by object of expenditure, with its legend. */
function donutSvg(t: MrdTotals) {
  const groups = classSummary(t);
  const cx = 62, cy = 62, R = 58, r = 34;
  let angle = -Math.PI / 2;
  const pt = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
  const arcs = groups
    .filter((g) => g.amount > 0)
    .map((g) => {
      const sweep = g.share * Math.PI * 2;
      const a0 = angle;
      const a1 = (angle += sweep);
      const mid = (a0 + a1) / 2;
      const large = sweep > Math.PI ? 1 : 0;
      const path = sweep >= Math.PI * 2 - 1e-6
        ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${g.color}" stroke-width="${R - r}"/>`
        : `<path d="M ${pt(R, a0)} A ${R} ${R} 0 ${large} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${large} 0 ${pt(r, a0)} Z" fill="${g.color}" stroke="#fff" stroke-width="1"/>`;
      const label = g.share >= 0.03 ? `<text x="${cx + ((R + r) / 2) * Math.cos(mid)}" y="${cy + ((R + r) / 2) * Math.sin(mid) + 3}" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff">${(g.share * 100).toFixed(1)}%</text>` : "";
      return path + label;
    })
    .join("");
  const center = `<text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e3a8a">${esc(compact(t.total))}</text><text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="6.5" fill="#1e3a8a">Total</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="6.5" fill="#1e3a8a">Disbursements</text>`;
  const legend = `<table class="legend">${groups.map((g) => `<tr><td><i style="background:${g.color}"></i></td><td>${esc(g.name)}</td><td class="n">${(g.share * 100).toFixed(1)}%</td><td class="n">₱ ${peso(g.amount)}</td></tr>`).join("")}</table>`;
  return `<div class="donut"><svg viewBox="0 0 124 124" width="170" height="170" role="img" aria-label="Disbursements by object of expenditure">${t.total ? arcs : `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="#e5e7eb" stroke-width="${R - r}"/>`}${center}</svg>${legend}</div>`;
}

// Page layout in millimetres (A4 landscape, 190 mm of usable height under the margins).
const BODY_MM = 188;
const HEADER_MM = 22;
const ROW_MM = 5.2;
const HEAD_MM = 7;
const TITLE_MM = 9;

type Block = { html: string; mm: number } | { title: string; head: string; rows: string[]; newPage?: boolean };

/** Flows blocks onto pages; tables split across pages and repeat their header. */
function paginate(blocks: Block[], header: string) {
  const pages: string[] = [];
  let room = 0;
  const newPage = () => {
    pages.push(header);
    room = BODY_MM - HEADER_MM;
  };
  newPage();
  for (const b of blocks) {
    if ("html" in b) {
      if (b.mm > room && room < BODY_MM - HEADER_MM) newPage();
      pages[pages.length - 1] += b.html;
      room -= b.mm;
      continue;
    }
    if (b.newPage && room < BODY_MM - HEADER_MM) newPage();
    let i = 0;
    let first = true;
    while (i < b.rows.length || first) {
      const need = TITLE_MM + HEAD_MM + ROW_MM * Math.min(3, Math.max(1, b.rows.length - i));
      if (need > room) newPage();
      const fit = Math.max(1, Math.floor((room - TITLE_MM - HEAD_MM) / ROW_MM));
      const chunk = b.rows.slice(i, i + fit);
      pages[pages.length - 1] += `<h3 class="sec">${esc(b.title)}${first ? "" : " (continued)"}</h3><table class="detail">${b.head}<tbody>${chunk.join("")}</tbody></table>`;
      room -= TITLE_MM + HEAD_MM + chunk.length * ROW_MM;
      i += chunk.length;
      first = false;
    }
  }
  return pages;
}

/** Printable BFARS 9 report (HTML pages), used for the preview, PDF (print) and download. */
export function buildMrdDocument(report: MrdReport, opts: MrdDocOptions, labels: MrdFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const { fiscalYear, month } = report;
  const p = splitPeriods(report.rows, month);
  const cur = sumByClass(p.current);
  const ytd = sumByClass(p.ytd);
  const prev = sumByClass(p.previous);
  const monthText = monthLabel(fiscalYear, month);
  const fundSources = [...new Set(report.rows.map((r) => r.fundSource))].join(", ") || "–";

  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 9<br/>Annex I</div></div>`;
  const paramRows: [string, string][] = [
    ["Department/Office", labels.department],
    ["Allotment Class", labels.allotmentClass],
    ["UACS (Major)", labels.uacsMajor],
    ...(opts.fundSource ? [["Fund Source", fundSources] as [string, string]] : []),
  ];
  const title = `<div class="top"><table class="params">${paramRows.map(([k, v]) => `<tr><td>${k}</td><td>:</td><td>${esc(v)}</td></tr>`).join("")}</table><div class="title"><h1>${MRD_TITLE.toUpperCase()}</h1><p>For the Month of ${esc(monthText)}<br/>(Fiscal Year ${fiscalYear})</p></div><div></div></div>`;
  const blocks: Block[] = [{ html: title, mm: 24 }];

  if (opts.summary) {
    const cols = (t: MrdTotals, code?: ObjectClass) => `${MRD_OBJECTS.map((o) => `<td class="n">${dash(code && code !== o.code ? 0 : t[o.code])}</td>`).join("")}<td class="n b">${peso(code ? t[code] : t.total)}</td>`;
    const matrix = `<table class="matrix"><thead><tr><th rowspan="2">UACS<br/>Code</th><th rowspan="2">Object of Expenditure</th><th colspan="6">Current Month (${esc(monthText)})</th><th colspan="6">Year-to-Date (${esc(ytdLabel(fiscalYear, month))})</th></tr><tr>${[0, 1].map(() => `${MRD_OBJECTS.map((o) => `<th>${o.code}</th>`).join("")}<th>Total (₱)</th>`).join("")}</tr></thead><tbody>${MRD_OBJECTS.map((o) => `<tr><td class="c">${o.uacs}</td><td>${esc(o.name)}</td>${cols(cur, o.code)}${cols(ytd, o.code)}</tr>`).join("")}</tbody><tfoot><tr><td colspan="2" class="c">TOTAL</td>${cols(cur)}${cols(ytd)}</tr></tfoot></table>`;
    blocks.push({ html: matrix, mm: 46 });

    if (opts.previousMonth) {
      const body =
        month > 1
          ? `${MRD_OBJECTS.map((o) => `<tr><td>${esc(o.name)}</td><td class="n">${dash(prev[o.code])}</td><td class="n">${dash(cur[o.code])}</td><td class="n">${dash(cur[o.code] - prev[o.code])}</td><td class="n">${pct(changeRatio(cur[o.code], prev[o.code]))}</td></tr>`).join("")}</tbody><tfoot><tr><td class="c">TOTAL</td><td class="n">${peso(prev.total)}</td><td class="n">${peso(cur.total)}</td><td class="n">${peso(cur.total - prev.total)}</td><td class="n">${pct(changeRatio(cur.total, prev.total))}</td></tr></tfoot>`
          : `<tr><td colspan="5" class="c">January is the first month of the fiscal year; there is no previous month to compare.</td></tr></tbody>`;
      blocks.push({
        html: `<h3 class="sec">Comparison with Previous Month</h3><table class="cmp"><thead><tr><th>Object of Expenditure</th><th>${month > 1 ? esc(monthLabel(fiscalYear, month - 1)) : "Previous Month"} (₱)</th><th>${esc(monthText)} (₱)</th><th>Increase / (Decrease) (₱)</th><th>% Change</th></tr></thead><tbody>${body}</table>`,
        mm: month > 1 ? 52 : 22,
      });
    }

    blocks.push({
      html: `<div class="panels"><div class="panel"><h3>Monthly Disbursements Trend (FY ${fiscalYear})</h3><div class="pbody">${trendSvg(report.rows, fiscalYear, month)}</div></div><div class="panel"><h3>Disbursements by Object of Expenditure (${esc(monthText)})</h3><div class="pbody">${donutSvg(cur)}</div></div></div>`,
      mm: 72,
    });
  }

  if (opts.details) {
    const fund = opts.fundSource;
    const span = fund ? 9 : 8;
    const head = `<thead><tr><th>#</th><th>Reference</th><th>Date</th><th>Payee / Supplier</th><th>UACS Code</th><th>Class</th><th>Allotment</th><th>Description</th>${fund ? "<th>Fund Source</th>" : ""}<th>Amount (₱)</th></tr></thead>`;
    let n = 0;
    const line = (r: MrdRow) => `<tr><td class="c">${++n}</td><td>${esc(r.referenceNo)}</td><td>${esc(lasaDate(r.date))}</td><td>${esc(r.payee)}</td><td class="c">${esc(r.uacsCode)}</td><td class="c">${r.objectClass}</td><td class="c">${r.allotmentClass}</td><td>${esc(r.description)}</td>${fund ? `<td class="c">${esc(r.fundSource)}</td>` : ""}<td class="n">${peso(r.amount)}</td></tr>`;
    const rows = opts.groupByUacs
      ? groupByObject(p.current).flatMap((g) => [
          `<tr class="grp"><td colspan="${span + 1}">${g.major.replace(/^(\d)(\d\d)$/, "$1-$2")} – ${esc(g.name)}</td></tr>`,
          ...g.rows.map(line),
          `<tr class="sub"><td colspan="${span}">Subtotal – ${g.code}</td><td class="n">${peso(g.rows.reduce((s, r) => s + r.amount, 0))}</td></tr>`,
        ])
      : p.current.map(line);
    if (!rows.length) rows.push(`<tr><td colspan="${span + 1}" class="c">No disbursements match the selected parameters.</td></tr>`);
    rows.push(`<tr class="total"><td colspan="${span}">TOTAL</td><td class="n">${peso(cur.total)}</td></tr>`);
    // The listing starts on its own page after the summary, as in the sample workbook.
    blocks.push({ title: `Disbursement Transaction Details — ${monthText.toUpperCase()}`, head, rows, newPage: opts.summary });
  }

  if (opts.signatories) {
    blocks.push({
      html: `<div class="sigs">${report.signatories.map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`).join("")}</div>`,
      mm: 32,
    });
  }

  const pages = paginate(blocks, header);
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 9 – Monthly Report of Disbursement ${esc(monthText)}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:7mm 9mm 13mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:90px 1fr 120px;align-items:start;gap:10px;height:20mm}.hdr img{width:62px;height:62px;object-fit:contain;margin-left:14px}.org{text-align:center;font-size:10.5px;line-height:1.4}.org b{font-size:12px}.form{text-align:right;font-weight:bold;font-size:11px;line-height:1.5}
.top{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:10px;margin:0 0 6px}.title{text-align:center}
h1{font-size:15px;margin:0 0 2px;white-space:nowrap}.title p{margin:0;font-size:11px;line-height:1.35}h3{font-size:11px;margin:0}h3.sec{color:#1e3a8a;margin:8px 0 4px}
.params{width:auto;border-collapse:collapse}.params td{border:0;padding:0.5px 6px 0.5px 0;font-size:9.5px}.params td:first-child{font-weight:bold;width:100px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #bfd3ea;padding:2.5px 4px;text-align:left;vertical-align:middle}th{background:#dbeafe;font-size:8.5px;text-align:center;color:#1e293b}td.n{text-align:right;white-space:nowrap}td.c{text-align:center}td.b{font-weight:bold}
.matrix td{font-size:8px;padding:5px 3px}.matrix th{font-size:8px}
.detail td{white-space:nowrap}tr.grp td{background:#eff6ff;font-weight:bold;color:#1e3a8a}tr.sub td{font-weight:bold;text-align:right;background:#f8fafc}
tr.total td{font-weight:bold;background:#cfe2fb;text-align:right}tr.total td:first-child{text-align:center}tfoot td{font-weight:bold;background:#cfe2fb}
.cmp{width:75%}
.panels{display:grid;grid-template-columns:1.15fr 1fr;gap:9px;margin-top:8px}
.panel{border:1px solid #bfd3ea;border-radius:3px;overflow:hidden}.panel h3{color:#1e3a8a;padding:5px 8px 0;font-size:10.5px}.pbody{padding:2px 6px 4px}
.donut{display:flex;align-items:center;gap:8px}.legend{width:auto;flex:1}.legend td{border:0;padding:4px 3px;font-size:9px;color:#1e3a8a}.legend i{display:inline-block;width:8px;height:8px;border-radius:50%}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:14px}.sigs .line{border-bottom:1px solid #111;height:22px;margin:0 30px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin:6px 0 0 30px}.sigs .date i{display:inline-block;width:150px;border-bottom:1px solid #111}
footer{position:absolute;left:9mm;right:9mm;bottom:5mm;display:flex;justify-content:space-between;color:#6b7280;font-size:7.5px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((pg, i) => `<section class="page" id="page-${i + 1}">${pg}<footer>${esc(report.agency)} • BFARS 9 – ${MRD_TITLE} • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets (MRD Summary as in the sample workbook, Transactions, Previous Month) for XLSX / XLS export. */
export function buildMrdSheets(report: MrdReport, opts: MrdDocOptions, labels: MrdFilterLabels): XlsxSheet[] {
  const { fiscalYear, month } = report;
  const p = splitPeriods(report.rows, month);
  const cur = sumByClass(p.current);
  const prior = sumByClass(p.prior);
  const ytd = sumByClass(p.ytd);
  const prev = sumByClass(p.previous);
  const monthText = monthLabel(fiscalYear, month);
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 9 – ${title}`],
    [`${report.agency} • For the Month of ${monthText} • Fiscal Year ${fiscalYear}`],
    [`Department/Office: ${labels.department} • Allotment Class: ${labels.allotmentClass} • UACS (Major): ${labels.uacsMajor}`],
    [],
  ];
  const sheets: XlsxSheet[] = [];
  if (opts.summary) {
    const priorHead = month > 1 ? `${MONTHS[0].slice(0, 3)}–${MONTHS[month - 2].slice(0, 3)}` : "Prior Months";
    const rows: XlsxCell[][] = [
      ...intro(MRD_TITLE),
      ["UACS Code", "Object of Expenditure", "Current Month", priorHead, `YTD ${ytdLabel(fiscalYear, month)}`],
      ...MRD_OBJECTS.map((o): XlsxCell[] => [o.uacs, o.name, cur[o.code], prior[o.code], ytd[o.code]]),
      ["", "GRAND TOTAL", cur.total, prior.total, ytd.total],
    ];
    sheets.push({ name: "MRD Summary", rows, boldRows: [0, 4, rows.length - 1], columnWidths: [11, 44, 18, 18, 24] });
    if (opts.previousMonth && month > 1) {
      const cmp: XlsxCell[][] = [
        ...intro("Comparison with Previous Month"),
        ["Object of Expenditure", monthLabel(fiscalYear, month - 1), monthText, "Increase / (Decrease)", "% Change"],
        ...MRD_OBJECTS.map((o): XlsxCell[] => {
          const r = changeRatio(cur[o.code], prev[o.code]);
          return [o.name, prev[o.code], cur[o.code], cur[o.code] - prev[o.code], r === null ? "" : Math.round(r * 10000) / 100];
        }),
        ["TOTAL", prev.total, cur.total, cur.total - prev.total, prev.total ? Math.round((changeRatio(cur.total, prev.total) ?? 0) * 10000) / 100 : ""],
      ];
      sheets.push({ name: "Previous Month", rows: cmp, boldRows: [0, 4, cmp.length - 1], columnWidths: [44, 18, 18, 20, 10] });
    }
  }
  if (opts.details || !sheets.length) {
    const head = ["#", "Reference", "Date", "Payee / Supplier", "UACS Code", "Object of Expenditure", "Class", "Allotment", "Description", ...(opts.fundSource ? ["Fund Source"] : []), "Amount"];
    const pad = head.length - 1;
    let n = 0;
    const line = (r: MrdRow): XlsxCell[] => [++n, r.referenceNo, lasaDate(r.date), r.payee, r.uacsCode, r.objectOfExpenditure, r.objectClass, r.allotmentClass, r.description, ...(opts.fundSource ? [r.fundSource] : []), r.amount];
    const body: XlsxCell[][] = opts.groupByUacs
      ? groupByObject(p.current).flatMap((g) => [[`${g.major} – ${g.name}`], ...g.rows.map(line), [`Subtotal – ${g.code}`, ...Array(pad - 1).fill(""), g.rows.reduce((s, r) => s + r.amount, 0)]])
      : p.current.map(line);
    const rows: XlsxCell[][] = [...intro(`Disbursement Transaction Details — ${monthText}`), head, ...body, ["TOTAL", ...Array(pad - 1).fill(""), cur.total]];
    sheets.push({ name: "Transactions", rows, boldRows: [0, 4, rows.length - 1], columnWidths: [6, 16, 14, 28, 12, 24, 9, 10, 28, ...(opts.fundSource ? [11] : []), 16] });
  }
  return sheets;
}

export const mrdFileName = (report: MrdReport, ext: string) => `MPC_BFARS9_MRD_FY${report.fiscalYear}_${MONTHS[report.month - 1]}.${ext}`;
