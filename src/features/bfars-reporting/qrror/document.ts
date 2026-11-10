import { formatCompactCurrency, formatCurrency, safeRatio } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import { lasaDate } from "../lasa/document";
import { MONTHS } from "../mrd/document";
import type { Quarter } from "../qpro/types";
import type { QrrorReport, QrrorRow, RevenueClass } from "./types";

export const QRROR_TITLE = "Quarterly Report of Revenue and Other Receipts (QRROR)";

/** Revenue classifications with the chart colors (blue / red / green) and KPI card colors of the BFARS 10 mockups. */
export const QRROR_CLASSES: { code: RevenueClass; name: string; color: string; cardColor: string }[] = [
  { code: "4-01", name: "Income from Operations", color: "#2f7cf6", cardColor: "#2563eb" },
  { code: "4-02", name: "Income from Non-Operations", color: "#ec2027", cardColor: "#f5b301" },
  { code: "4-03", name: "Other Receipts", color: "#3cb455", cardColor: "#a855f7" },
];
export const className = (code: string) => QRROR_CLASSES.find((c) => c.code === code)?.name ?? code;

const ORDINAL = ["1st", "2nd", "3rd", "4th"];
const qIndex = (q: Quarter) => Number(q.slice(1)) - 1;
/** Months (1–12) of the quarter. */
export const quarterMonths = (q: Quarter) => [1, 2, 3].map((m) => qIndex(q) * 3 + m);
export const monthOf = (r: Pick<QrrorRow, "date">) => Number(r.date.slice(5, 7));
/** "1st Quarter 2026" */
export const quarterLabel = (fiscalYear: number, q: Quarter) => `${ORDINAL[qIndex(q)]} Quarter ${fiscalYear}`;
/** "March 31, 2026" */
export const quarterEndText = (fiscalYear: number, q: Quarter) => {
  const last = quarterMonths(q)[2];
  return `${MONTHS[last - 1]} ${new Date(Date.UTC(fiscalYear, last, 0)).getUTCDate()}, ${fiscalYear}`;
};
/** "January – March 2026" */
export const ytdLabel = (fiscalYear: number, q: Quarter) => `January – ${MONTHS[quarterMonths(q)[2] - 1]} ${fiscalYear}`;

export type QrrorTotals = Record<RevenueClass, number> & { total: number; count: number };
const emptyTotals = (): QrrorTotals => ({ "4-01": 0, "4-02": 0, "4-03": 0, total: 0, count: 0 });

/** Amount per revenue classification, total and number of receipts. */
export function sumByClass(rows: QrrorRow[]): QrrorTotals {
  return rows.reduce((t, r) => {
    t[r.classification] += r.amount;
    t.total += r.amount;
    t.count += 1;
    return t;
  }, emptyTotals());
}

/** Receipts of the selected quarter and of the year to date. */
export function splitPeriods(rows: QrrorRow[], q: Quarter) {
  const months = quarterMonths(q);
  return { current: rows.filter((r) => months.includes(monthOf(r))), ytd: rows.filter((r) => monthOf(r) <= months[2]) };
}

/** Amount and share of the total for each classification. */
export const classSummary = (t: QrrorTotals) => QRROR_CLASSES.map((c) => ({ ...c, amount: t[c.code], share: safeRatio(t[c.code], t.total) }));

/** Change as a ratio, or null when there is nothing to compare with. */
export const changeRatio = (current: number, previous: number) => (previous ? (current - previous) / previous : null);

/** The quarter's receipts per month, split by classification (the trend chart). */
export function monthlyByClass(rows: QrrorRow[], q: Quarter) {
  return quarterMonths(q).map((m) => {
    const t = sumByClass(rows.filter((r) => monthOf(r) === m));
    return { month: MONTHS[m - 1], monthNo: m, "4-01": t["4-01"], "4-02": t["4-02"], "4-03": t["4-03"], total: t.total };
  });
}

/** Rows grouped under their classification, in report order. */
export const groupByClass = (rows: QrrorRow[]) => QRROR_CLASSES.map((c) => ({ ...c, rows: rows.filter((r) => r.classification === c.code) })).filter((g) => g.rows.length);

export interface QrrorDocOptions {
  summary: boolean;
  details: boolean;
  groupByClass: boolean;
  previousQuarter: boolean;
  signatories: boolean;
}

export interface QrrorFilterLabels {
  department: string;
  classification: string;
  uacsMajor: string;
}

const peso = (v: number) => formatCurrency(v).replace("₱", "");
const dash = (v: number) => (v ? peso(v) : "-");
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const compact = (v: number) => formatCompactCurrency(v).replace("₱", "₱ ");
const share = (r: number) => `${(r * 100).toFixed(2)}%`;
const pct = (r: number | null) => (r === null ? "–" : `${r >= 0 ? "+" : ""}${(r * 100).toFixed(2)}%`);

/** A 1–2–5 step that keeps the axis to about five ticks. */
function niceStep(max: number) {
  const raw = Math.max(max, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
}

/** Grouped monthly bars by classification (₱ millions) with value labels, as in the report mockup. */
function trendSvg(rows: QrrorRow[], q: Quarter, title: string) {
  const data = monthlyByClass(rows, q);
  const W = 420, H = 180, left = 40, bottom = 140, top = 14;
  const peak = Math.max(...data.flatMap((d) => QRROR_CLASSES.map((c) => d[c.code])));
  const step = niceStep(peak);
  const max = Math.max(step, Math.ceil(peak / step) * step);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const slot = (W - left) / 3;
  const w = slot * 0.2;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const bars = data
    .map((d, i) => {
      const x0 = left + i * slot + slot * 0.2;
      return (
        QRROR_CLASSES.map((c, j) => {
          const v = d[c.code];
          const x = x0 + j * w;
          return `<rect x="${x}" y="${y(v)}" width="${w - 2}" height="${bottom - y(v)}" fill="${c.color}"/>${v ? `<text x="${x + (w - 2) / 2}" y="${y(v) - 3}" text-anchor="middle" font-size="7" font-weight="bold" fill="#1e3a8a">${esc(compact(v))}</text>` : ""}`;
        }).join("") + `<text x="${x0 + 1.5 * w}" y="${bottom + 12}" text-anchor="middle" font-size="8" fill="#1e3a8a">${d.month}</text>`
      );
    })
    .join("");
  const offsets = [0, 120, 255];
  const legend = QRROR_CLASSES.map((c, i) => `<rect x="${left + offsets[i]}" y="${H - 9}" width="7" height="7" fill="${c.color}"/><text x="${left + offsets[i] + 10}" y="${H - 3}" font-size="7.5" fill="#1e3a8a">${esc(c.name)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="215" role="img" aria-label="${esc(title)}">
<text x="9" y="${(top + bottom) / 2}" transform="rotate(-90 9 ${(top + bottom) / 2})" text-anchor="middle" font-size="7.5" fill="#374151">Amount (₱ Millions)</text>
${ticks.map((v) => `<line x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e7eb"/><text x="${left - 5}" y="${y(v) + 3}" text-anchor="end" font-size="7.5" fill="#374151">${v ? +(v / 1_000_000).toFixed(1) : "0"}</text>`).join("")}
${bars}${legend}</svg>`;
}

/** Donut of the quarter's receipts by classification, with its legend. */
function donutSvg(t: QrrorTotals) {
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
      const label = g.share >= 0.03 ? `<text x="${cx + ((R + r) / 2) * Math.cos(mid)}" y="${cy + ((R + r) / 2) * Math.sin(mid) + 3}" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#fff">${share(g.share)}</text>` : "";
      return path + label;
    })
    .join("");
  const center = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e3a8a">${esc(compact(t.total))}</text><text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="6" fill="#1e3a8a">Total Revenue</text><text x="${cx}" y="${cy + 17}" text-anchor="middle" font-size="6" fill="#1e3a8a">and Other Receipts</text>`;
  const legend = `<table class="legend">${groups.map((g) => `<tr><td><i style="background:${g.color}"></i></td><td>${esc(g.name)}</td><td class="n">${share(g.share)}</td><td class="n">₱ ${peso(g.amount)}</td></tr>`).join("")}</table>`;
  return `<div class="donut"><svg viewBox="0 0 124 124" width="170" height="170" role="img" aria-label="Revenue and other receipts by classification">${t.total ? arcs : `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="#e5e7eb" stroke-width="${R - r}"/>`}${center}</svg>${legend}</div>`;
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

/** Printable BFARS 10 report (HTML pages), used for the preview, PDF (print) and download. */
export function buildQrrorDocument(report: QrrorReport, opts: QrrorDocOptions, labels: QrrorFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const { fiscalYear, quarter } = report;
  const p = splitPeriods(report.rows, quarter);
  const cur = sumByClass(p.current);
  const ytd = sumByClass(p.ytd);
  const qText = quarterLabel(fiscalYear, quarter);
  const months = quarterMonths(quarter);

  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 10<br/>Annex J</div></div>`;
  const paramRows: [string, string][] = [
    ["Department/Office", labels.department],
    ["Revenue Classification", labels.classification],
    ["UACS (Major)", labels.uacsMajor],
  ];
  const title = `<div class="top"><table class="params">${paramRows.map(([k, v]) => `<tr><td>${k}</td><td>:</td><td>${esc(v)}</td></tr>`).join("")}</table><div class="title"><h1>${QRROR_TITLE.toUpperCase()}</h1><p>For the Quarter Ending ${esc(quarterEndText(fiscalYear, quarter))}<br/>(Fiscal Year ${fiscalYear})</p></div><div></div></div>`;
  const blocks: Block[] = [{ html: title, mm: 24 }];

  if (opts.summary) {
    const monthCells = (code?: RevenueClass) => months.map((m) => {
      const t = sumByClass(p.current.filter((r) => monthOf(r) === m));
      return `<td class="n">${dash(code ? t[code] : t.total)}</td>`;
    }).join("");
    const matrix = `<table class="matrix"><thead><tr><th rowspan="2">UACS<br/>Code</th><th rowspan="2">Revenue Classification</th><th colspan="4">Current Quarter<br/>(${esc(qText)})</th><th colspan="2">Year-to-Date<br/>(${esc(ytdLabel(fiscalYear, quarter))})</th></tr><tr>${months.map((m) => `<th>${MONTHS[m - 1]}<br/>(₱)</th>`).join("")}<th>Total<br/>(₱)</th><th>Total<br/>(₱)</th><th>% of Total</th></tr></thead><tbody>${QRROR_CLASSES.map((c) => `<tr><td class="c">${c.code}</td><td>${esc(c.name)}</td>${monthCells(c.code)}<td class="n b">${peso(cur[c.code])}</td><td class="n">${peso(ytd[c.code])}</td><td class="n">${share(safeRatio(ytd[c.code], ytd.total))}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="2" class="c">TOTAL</td>${monthCells()}<td class="n">${peso(cur.total)}</td><td class="n">${peso(ytd.total)}</td><td class="n">${ytd.total ? "100.00%" : "0.00%"}</td></tr></tfoot></table>`;
    blocks.push({ html: matrix, mm: 36 });

    if (opts.previousQuarter) {
      const prevRows = report.previousQuarter?.rows;
      const prev = prevRows ? sumByClass(prevRows) : null;
      const body = prev
        ? `${QRROR_CLASSES.map((c) => `<tr><td>${esc(c.name)}</td><td class="n">${dash(prev[c.code])}</td><td class="n">${dash(cur[c.code])}</td><td class="n">${dash(cur[c.code] - prev[c.code])}</td><td class="n">${pct(changeRatio(cur[c.code], prev[c.code]))}</td></tr>`).join("")}</tbody><tfoot><tr><td class="c">TOTAL</td><td class="n">${peso(prev.total)}</td><td class="n">${peso(cur.total)}</td><td class="n">${peso(cur.total - prev.total)}</td><td class="n">${pct(changeRatio(cur.total, prev.total))}</td></tr></tfoot>`
        : `<tr><td colspan="5" class="c">No data is available for the previous quarter.</td></tr></tbody>`;
      blocks.push({
        html: `<h3 class="sec">Comparison with Previous Quarter</h3><table class="cmp"><thead><tr><th>Revenue Classification</th><th>${esc(report.previousQuarter?.label ?? "Previous Quarter")} (₱)</th><th>Q${quarter.slice(1)} ${fiscalYear} (₱)</th><th>Increase / (Decrease) (₱)</th><th>% Change</th></tr></thead><tbody>${body}</table>`,
        mm: prev ? 28 : 18,
      });
    }

    blocks.push({
      html: `<div class="panels"><div class="panel"><h3>Monthly Revenue and Other Receipts (${esc(qText)})</h3><div class="pbody">${trendSvg(p.current, quarter, `Monthly revenue and other receipts, ${qText}`)}</div></div><div class="panel"><h3>Revenue and Other Receipts by Classification (${esc(qText)})</h3><div class="pbody">${donutSvg(cur)}</div></div></div>`,
      mm: 72,
    });
  }

  if (opts.details) {
    const head = `<thead><tr><th>#</th><th>Date</th><th>Reference No.</th><th>Revenue Classification</th><th>UACS Code</th><th>Description</th><th>Amount (₱)</th></tr></thead>`;
    let n = 0;
    const line = (r: QrrorRow) => `<tr><td class="c">${++n}</td><td>${esc(lasaDate(r.date))}</td><td>${esc(r.referenceNo)}</td><td>${esc(className(r.classification))}</td><td class="c">${esc(r.uacsCode)}</td><td>${esc(r.description)}</td><td class="n">${peso(r.amount)}</td></tr>`;
    const rows = opts.groupByClass
      ? groupByClass(p.current).flatMap((g) => [
          `<tr class="grp"><td colspan="7">${g.code} – ${esc(g.name)}</td></tr>`,
          ...g.rows.map(line),
          `<tr class="sub"><td colspan="6">Subtotal – ${esc(g.name)}</td><td class="n">${peso(g.rows.reduce((s, r) => s + r.amount, 0))}</td></tr>`,
        ])
      : p.current.map(line);
    if (!rows.length) rows.push(`<tr><td colspan="7" class="c">No receipts match the selected parameters.</td></tr>`);
    rows.push(`<tr class="total"><td colspan="6">TOTAL</td><td class="n">${peso(cur.total)}</td></tr>`);
    // The listing starts on its own page after the summary, as in the sample workbook.
    blocks.push({ title: `Revenue and Other Receipts Transactions — ${qText.toUpperCase()}`, head, rows, newPage: opts.summary });
  }

  if (opts.signatories) {
    blocks.push({
      html: `<div class="sigs">${report.signatories.map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`).join("")}</div>`,
      mm: 32,
    });
  }

  const pages = paginate(blocks, header);
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 10 – Quarterly Report of Revenue and Other Receipts ${esc(qText)}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:7mm 9mm 13mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:90px 1fr 120px;align-items:start;gap:10px;height:20mm}.hdr img{width:62px;height:62px;object-fit:contain;margin-left:14px}.org{text-align:center;font-size:10.5px;line-height:1.4}.org b{font-size:12px}.form{text-align:right;font-weight:bold;font-size:11px;line-height:1.5}
.top{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:10px;margin:0 0 6px}.title{text-align:center}
h1{font-size:15px;margin:0 0 2px;white-space:nowrap}.title p{margin:0;font-size:11px;line-height:1.35}h3{font-size:11px;margin:0}h3.sec{color:#1e3a8a;margin:8px 0 4px}
.params{width:auto;border-collapse:collapse}.params td{border:0;padding:0.5px 6px 0.5px 0;font-size:9.5px}.params td:first-child{font-weight:bold;width:120px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #bfd3ea;padding:2.5px 4px;text-align:left;vertical-align:middle}th{background:#dbeafe;font-size:8.5px;text-align:center;color:#1e293b}td.n{text-align:right;white-space:nowrap}td.c{text-align:center}td.b{font-weight:bold}
.matrix td{font-size:9px;padding:5px 5px}.matrix th{font-size:8.5px}
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
    .map((pg, i) => `<section class="page" id="page-${i + 1}">${pg}<footer>${esc(report.agency)} • BFARS 10 – ${QRROR_TITLE} • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets (QRROR Summary as in the sample workbook, Previous Quarter, Transactions) for XLSX / XLS export. */
export function buildQrrorSheets(report: QrrorReport, opts: QrrorDocOptions, labels: QrrorFilterLabels): XlsxSheet[] {
  const { fiscalYear, quarter } = report;
  const p = splitPeriods(report.rows, quarter);
  const cur = sumByClass(p.current);
  const ytd = sumByClass(p.ytd);
  const months = quarterMonths(quarter);
  const qText = quarterLabel(fiscalYear, quarter);
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 10 – ${title}`],
    [`${report.agency} • For the Quarter Ending ${quarterEndText(fiscalYear, quarter)} • Fiscal Year ${fiscalYear}`],
    [`Department/Office: ${labels.department} • Revenue Classification: ${labels.classification} • UACS (Major): ${labels.uacsMajor}`],
    [],
  ];
  const monthly = (code?: RevenueClass) => months.map((m) => {
    const t = sumByClass(p.current.filter((r) => monthOf(r) === m));
    return code ? t[code] : t.total;
  });
  const sheets: XlsxSheet[] = [];
  if (opts.summary) {
    const rows: XlsxCell[][] = [
      ...intro(QRROR_TITLE),
      ["UACS Code", "Revenue Classification", ...months.map((m) => MONTHS[m - 1]), `Q${quarter.slice(1)} Total`, `YTD ${ytdLabel(fiscalYear, quarter)}`, "% of Total"],
      ...QRROR_CLASSES.map((c): XlsxCell[] => [c.code, c.name, ...monthly(c.code), cur[c.code], ytd[c.code], Math.round(safeRatio(ytd[c.code], ytd.total) * 10000) / 100]),
      ["", "GRAND TOTAL", ...monthly(), cur.total, ytd.total, ytd.total ? 100 : 0],
    ];
    sheets.push({ name: "QRROR Summary", rows, boldRows: [0, 4, rows.length - 1], columnWidths: [11, 30, 16, 16, 16, 18, 24, 11] });
    const prevRows = report.previousQuarter?.rows;
    if (opts.previousQuarter && prevRows) {
      const prev = sumByClass(prevRows);
      const ratio = (a: number, b: number) => {
        const r = changeRatio(a, b);
        return r === null ? "" : Math.round(r * 10000) / 100;
      };
      const cmp: XlsxCell[][] = [
        ...intro("Comparison with Previous Quarter"),
        ["Revenue Classification", report.previousQuarter!.label, `Q${quarter.slice(1)} ${fiscalYear}`, "Increase / (Decrease)", "% Change"],
        ...QRROR_CLASSES.map((c): XlsxCell[] => [c.name, prev[c.code], cur[c.code], cur[c.code] - prev[c.code], ratio(cur[c.code], prev[c.code])]),
        ["TOTAL", prev.total, cur.total, cur.total - prev.total, ratio(cur.total, prev.total)],
      ];
      sheets.push({ name: "Previous Quarter", rows: cmp, boldRows: [0, 4, cmp.length - 1], columnWidths: [30, 18, 18, 20, 10] });
    }
  }
  if (opts.details || !sheets.length) {
    const head = ["#", "Date", "Reference No.", "Revenue Classification", "UACS Code", "Description", "Amount"];
    let n = 0;
    const line = (r: QrrorRow): XlsxCell[] => [++n, lasaDate(r.date), r.referenceNo, className(r.classification), r.uacsCode, r.description, r.amount];
    const body: XlsxCell[][] = opts.groupByClass
      ? groupByClass(p.current).flatMap((g) => [[`${g.code} – ${g.name}`], ...g.rows.map(line), [`Subtotal – ${g.name}`, "", "", "", "", "", g.rows.reduce((s, r) => s + r.amount, 0)]])
      : p.current.map(line);
    const rows: XlsxCell[][] = [...intro(`Revenue and Other Receipts Transactions — ${qText}`), head, ...body, ["TOTAL", "", "", "", "", "", cur.total]];
    sheets.push({ name: "Transactions", rows, boldRows: [0, 4, rows.length - 1], columnWidths: [6, 14, 16, 28, 12, 30, 16] });
  }
  return sheets;
}

export const qrrorFileName = (report: QrrorReport, ext: string) => `MPC_BFARS10_QRROR_FY${report.fiscalYear}_${report.quarter}.${ext}`;
