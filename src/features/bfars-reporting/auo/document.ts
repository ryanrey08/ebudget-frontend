import { formatCompactCurrency, formatCurrency, safeRatio } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import { lasaDate } from "../lasa/document";
import type { AuoObject, AuoReport, AuoRow } from "./types";

export const AUO_TITLE = "Aging of Unpaid Obligations";

/** Aging brackets as in the BFARS 8 report, with the colors of its charts. */
export const AGING_BUCKETS = [
  { key: "current", label: "Current", color: "#2f7cf6" },
  { key: "d30", label: "1 – 30 Days", color: "#16a34a" },
  { key: "d60", label: "31 – 60 Days", color: "#f5b301" },
  { key: "d90", label: "61 – 90 Days", color: "#f97316" },
  { key: "over90", label: "Over 90 Days", color: "#ef4444" },
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number]["key"];

/** Object of expenditure groups of the report's donut. */
export const AUO_OBJECTS: { code: AuoObject; name: string; color: string }[] = [
  { code: "PS", name: "Personnel Services (PS)", color: "#2f7cf6" },
  { code: "MOOE", name: "Maintenance & Other Operating Expenses (MOOE)", color: "#ec2027" },
  { code: "CO", name: "Capital Outlay (CO)", color: "#3cb455" },
  { code: "Others", name: "Others", color: "#f5b301" },
];

const DAY = 86_400_000;
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Days past the due date as of the report date (0 while not yet due). */
export const daysPastDue = (r: Pick<AuoRow, "dueDate">, asOf: string) => Math.max(0, Math.round((utc(asOf) - utc(r.dueDate)) / DAY));

/** Not yet due → Current; then 1–30, 31–60, 61–90 and over 90 days past due. */
export function bucketOf(r: Pick<AuoRow, "dueDate">, asOf: string): AgingBucket {
  const d = daysPastDue(r, asOf);
  if (d <= 0) return "current";
  if (d <= 30) return "d30";
  if (d <= 60) return "d60";
  if (d <= 90) return "d90";
  return "over90";
}
export const bucketLabel = (b: AgingBucket) => AGING_BUCKETS.find((x) => x.key === b)!.label;

export type AuoTotals = Record<AgingBucket, number> & { total: number; count: number };
const emptyTotals = (): AuoTotals => ({ total: 0, count: 0, current: 0, d30: 0, d60: 0, d90: 0, over90: 0 });

/** Total unpaid amount and the amount in each aging bracket. */
export function sumAging(rows: AuoRow[], asOf: string): AuoTotals {
  return rows.reduce((t, r) => {
    t[bucketOf(r, asOf)] += r.amount;
    t.total += r.amount;
    t.count += 1;
    return t;
  }, emptyTotals());
}

/** Bracket amounts and shares of the total (the report's "Summary by Aging Bracket"). */
export const bucketSummary = (t: AuoTotals) => AGING_BUCKETS.map((b) => ({ ...b, amount: t[b.key], share: safeRatio(t[b.key], t.total) }));

/** Unpaid amount per object of expenditure, every group listed. */
export function objectSummary(rows: AuoRow[]) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return AUO_OBJECTS.map((o) => {
    const amount = rows.filter((r) => r.objectOfExpenditure === o.code).reduce((s, r) => s + r.amount, 0);
    return { ...o, amount, share: safeRatio(amount, total) };
  });
}

/** "As of March 31, 2026" and "1st Quarter" for the report header. */
export const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const QUARTER_TEXT = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];
export const quarterOf = (iso: string) => QUARTER_TEXT[Math.ceil(Number(iso.slice(5, 7)) / 3) - 1];

export interface AuoDocOptions {
  summary: boolean;
  charts: boolean;
  signature: boolean;
}

export interface AuoFilterLabels {
  department: string;
  allotmentClass: string;
  uacsMajor: string;
}

const peso = (v: number) => formatCurrency(v).replace("₱", "");
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const compact = (v: number) => formatCompactCurrency(v).replace("₱", "₱ ");

/** Bar chart of the aging brackets (₱ millions), as in the report. */
function barSvg(t: AuoTotals) {
  const W = 330, H = 140, left = 30, bottom = 118, top = 14;
  const maxM = Math.max(5, Math.ceil(Math.max(...AGING_BUCKETS.map((b) => t[b.key])) / 1_000_000 / 5) * 5 + 5);
  const y = (m: number) => bottom - (m / maxM) * (bottom - top);
  const step = (W - left) / AGING_BUCKETS.length;
  const ticks = Array.from({ length: maxM / 5 + 1 }, (_, i) => i * 5);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Unpaid obligations by aging bracket">
${ticks.map((m) => `<line x1="${left}" x2="${W}" y1="${y(m)}" y2="${y(m)}" stroke="#e5e7eb"/><text x="${left - 5}" y="${y(m) + 3}" text-anchor="end" font-size="7.5" fill="#374151">${m}</text>`).join("")}
<text x="7" y="${(top + bottom) / 2}" font-size="7" fill="#374151" text-anchor="middle" transform="rotate(-90 7 ${(top + bottom) / 2})">Amount (₱ Millions)</text>
${AGING_BUCKETS.map((b, i) => {
  const v = t[b.key] / 1_000_000;
  const x = left + i * step + step * 0.18;
  const w = step * 0.64;
  return `<rect x="${x}" y="${y(v)}" width="${w}" height="${bottom - y(v)}" fill="${b.color}" rx="1.5"/>${v ? `<text x="${x + w / 2}" y="${y(v) - 4}" text-anchor="middle" font-size="8" font-weight="bold">${esc(compact(t[b.key]))}</text>` : ""}<text x="${x + w / 2}" y="${bottom + 13}" text-anchor="middle" font-size="7.5" fill="#1e3a8a">${esc(b.label)}</text>`;
}).join("")}
</svg>`;
}

/** Donut of unpaid obligations by object of expenditure with its legend. */
function donutSvg(rows: AuoRow[]) {
  const groups = objectSummary(rows);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  const cx = 62, cy = 62, R = 58, r = 34;
  let angle = -Math.PI / 2;
  const pt = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
  const arcs = groups
    .filter((g) => g.amount > 0)
    .map((g) => {
      const sweep = (g.amount / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = (angle += sweep);
      const mid = (a0 + a1) / 2;
      const large = sweep > Math.PI ? 1 : 0;
      const path = sweep >= Math.PI * 2 - 1e-6
        ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${g.color}" stroke-width="${R - r}"/>`
        : `<path d="M ${pt(R, a0)} A ${R} ${R} 0 ${large} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${large} 0 ${pt(r, a0)} Z" fill="${g.color}" stroke="#fff" stroke-width="1"/>`;
      const label = g.share >= 0.05 ? `<text x="${cx + ((R + r) / 2) * Math.cos(mid)}" y="${cy + ((R + r) / 2) * Math.sin(mid) + 3}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#fff">${(g.share * 100).toFixed(1)}%</text>` : "";
      return path + label;
    })
    .join("");
  const center = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e3a8a">${esc(compact(total))}</text><text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="6.5" fill="#1e3a8a">Total Unpaid</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="6.5" fill="#1e3a8a">Obligations</text>`;
  const legend = `<table class="legend">${groups.map((g) => `<tr><td><i style="background:${g.color}"></i></td><td>${esc(g.name)}</td><td class="n">${(g.share * 100).toFixed(1)}%</td><td class="n">₱ ${Math.round(g.amount).toLocaleString("en-US")}</td></tr>`).join("")}</table>`;
  return `<div class="donut"><svg viewBox="0 0 124 124" width="112" height="112" role="img" aria-label="Unpaid obligations by object of expenditure">${total ? arcs : `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="#e5e7eb" stroke-width="${R - r}"/>`}${center}</svg>${legend}</div>`;
}

// Table lines that fit on a landscape A4 page: the first page also carries the title and parameters.
const FIRST_PAGE_LINES = 33;
const PAGE_LINES = 35;
const PANEL_LINES = 11;
const SIGNATURE_LINES = 6;

/** Printable BFARS 8 report (HTML pages), used for the preview, PDF (print) and download. */
export function buildAuoDocument(report: AuoReport, opts: AuoDocOptions, labels: AuoFilterLabels, ctx: { logoUrl: string; generatedAt: string }) {
  const totals = sumAging(report.rows, report.asOf);
  const pages: string[] = [];
  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 8<br/>Annex H</div></div>`;
  const title = `<h1>BFARS 8 – ${AUO_TITLE.toUpperCase()}</h1><p class="asof">As of ${esc(longDate(report.asOf))}<br/>(${quarterOf(report.asOf)})</p>`;
  const paramRows: [string, string][] = [
    ["Fiscal Year", String(report.fiscalYear)],
    ["As of Date", longDate(report.asOf)],
    ["Department/Office", labels.department],
    ["Allotment Class", labels.allotmentClass],
    ["UACS (Major)", labels.uacsMajor],
  ];
  const params = `<table class="params">${paramRows.map(([k, v]) => `<tr><td>${k}</td><td>:</td><td>${esc(v)}</td></tr>`).join("")}</table>`;

  const thead = `<thead><tr><th rowspan="2">#</th><th rowspan="2">Reference No.</th><th rowspan="2">Date<br/>Obligated</th><th rowspan="2">Payee / Supplier</th><th rowspan="2">Object<br/>of Expenditure</th><th rowspan="2">Allotment<br/>Class</th><th rowspan="2">UACS<br/>Code</th><th rowspan="2">Description</th><th rowspan="2">Total Amount<br/>(₱)</th><th colspan="5">Aging of Unpaid Obligations (₱)</th></tr><tr>${AGING_BUCKETS.map((b) => `<th>${b.label}</th>`).join("")}</tr></thead>`;
  const lines = report.rows.map((r, i) => {
    const b = bucketOf(r, report.asOf);
    return `<tr><td class="c">${i + 1}</td><td>${esc(r.referenceNo)}</td><td>${esc(lasaDate(r.dateObligated))}</td><td>${esc(r.payee)}</td><td class="c">${r.objectOfExpenditure}</td><td class="c">${r.allotmentClass}</td><td class="c">${esc(r.uacsCode)}</td><td>${esc(r.description)}</td><td class="n">${peso(r.amount)}</td>${AGING_BUCKETS.map((x) => `<td class="${x.key === b ? "n" : "c"}">${x.key === b ? peso(r.amount) : "-"}</td>`).join("")}</tr>`;
  });
  if (!lines.length) lines.push(`<tr><td colspan="14" class="c">No unpaid obligations match the selected parameters.</td></tr>`);
  lines.push(`<tr class="total"><td colspan="8">TOTAL</td><td class="n">${peso(totals.total)}</td>${AGING_BUCKETS.map((b) => `<td class="n">${totals[b.key] ? `₱ ${peso(totals[b.key])}` : "-"}</td>`).join("")}</tr>`);

  const summary = opts.summary
    ? `<div class="panel"><h3>Summary by Aging Bracket</h3><table class="sum"><thead><tr><th>Aging Bracket</th><th>Amount (₱)</th><th>% of Total</th></tr></thead><tbody>${bucketSummary(totals)
        .map((b) => `<tr><td>${b.label}</td><td class="n">${peso(b.amount)}</td><td class="n">${(b.share * 100).toFixed(2)}%</td></tr>`)
        .join("")}</tbody><tfoot><tr><td class="c">TOTAL</td><td class="n">₱ ${peso(totals.total)}</td><td class="n">${totals.total ? "100.00%" : "0.00%"}</td></tr></tfoot></table></div>`
    : "";
  const charts = opts.charts
    ? `<div class="panel"><h3>Unpaid Obligations by Aging Bracket</h3><div class="pbody">${barSvg(totals)}</div></div><div class="panel"><h3>Unpaid Obligations by Object of Expenditure</h3><div class="pbody">${donutSvg(report.rows)}</div></div>`
    : "";
  const panelCount = (opts.summary ? 1 : 0) + (opts.charts ? 2 : 0);
  const panels = panelCount ? `<div class="panels p${panelCount}">${summary}${charts}</div>` : "";
  const signatures = opts.signature
    ? `<div class="sigs">${report.signatories.map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`).join("")}</div>`
    : "";

  // Detail pages, then the summary/charts and signatures on the last page when they fit.
  let start = 0;
  let room = 0;
  for (let p = 0; start < lines.length; p++) {
    const cap = p === 0 ? FIRST_PAGE_LINES : PAGE_LINES;
    const chunk = lines.slice(start, start + cap);
    start += cap;
    room = cap - chunk.length;
    pages.push(`${header}${p === 0 ? `<div class="top">${params}${title}<div></div></div>` : `<h3 class="cont">BFARS 8 – ${AUO_TITLE} (continued)</h3>`}<table class="detail">${thead}<tbody>${chunk.join("")}</tbody></table>`);
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
  if (panels) append(panels, PANEL_LINES);
  if (signatures) append(signatures, SIGNATURE_LINES);

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 8 – Aging of Unpaid Obligations FY ${report.fiscalYear} as of ${report.asOf}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:7mm 9mm 13mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:90px 1fr 120px;align-items:start;gap:10px}.hdr img{width:58px;height:58px;object-fit:contain;margin-left:14px}.org{text-align:center;font-size:10.5px;line-height:1.4}.org b{font-size:12px}.form{text-align:right;font-weight:bold;font-size:11px;line-height:1.5}
.top{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:10px;margin:2px 0 6px}
h1{text-align:center;font-size:15px;margin:0 0 2px;color:#111827;white-space:nowrap}.asof{text-align:center;margin:0;font-size:11px;line-height:1.35}h3{font-size:11px;margin:0}.cont{color:#1e3a8a;margin:4px 0}
.params{width:auto;border-collapse:collapse}.params td{border:0;padding:0.5px 6px 0.5px 0;font-size:9.5px}.params td:first-child{font-weight:bold;width:100px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #bfd3ea;padding:2.5px 4px;text-align:left;vertical-align:middle}th{background:#dbeafe;font-size:8.5px;text-align:center;color:#1e293b}td.n{text-align:right;white-space:nowrap}td.c{text-align:center}
.detail td{white-space:nowrap}tr.total td{font-weight:bold;background:#cfe2fb;text-align:right}tr.total td:first-child{text-align:center}tfoot td{font-weight:bold;background:#cfe2fb}
.panels{display:grid;gap:9px;margin-top:8px}.panels.p3{grid-template-columns:0.85fr 1.1fr 1.05fr}.panels.p2{grid-template-columns:1fr 1fr}.panels.p1{grid-template-columns:0.5fr}
.panel{border:1px solid #bfd3ea;border-radius:3px;overflow:hidden}.panel h3{background:#0b3b7a;color:#fff;padding:5px 8px;font-size:10px}.panel .sum{border:0}.panel .sum th,.panel .sum td{border-left:0;border-right:0}.pbody{padding:4px 6px}
.donut{display:flex;align-items:center;gap:8px}.legend{width:auto;flex:1}.legend td{border:0;padding:3px 3px;font-size:8px;color:#1e3a8a}.legend i{display:inline-block;width:8px;height:8px;border-radius:50%}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:12px}.sigs .line{border-bottom:1px solid #111;height:22px;margin:0 30px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin:6px 0 0 30px}.sigs .date i{display:inline-block;width:150px;border-bottom:1px solid #111}
footer{position:absolute;left:9mm;right:9mm;bottom:5mm;display:flex;justify-content:space-between;color:#6b7280;font-size:7.5px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((p, i) => `<section class="page" id="page-${i + 1}">${p}<footer>${esc(report.agency)} • BFARS 8 – ${AUO_TITLE} • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets (Aging Detail, Aging Summary, Object of Expenditure) for XLSX / XLS export. */
export function buildAuoSheets(report: AuoReport, opts: AuoDocOptions, labels: AuoFilterLabels): XlsxSheet[] {
  const totals = sumAging(report.rows, report.asOf);
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 8 – ${title}`],
    [`${report.agency} • Fiscal Year ${report.fiscalYear} • As of ${longDate(report.asOf)} (${quarterOf(report.asOf)})`],
    [`Department/Office: ${labels.department} • Allotment Class: ${labels.allotmentClass} • UACS (Major): ${labels.uacsMajor}`],
    [],
  ];
  const head = ["#", "Reference No.", "Date Obligated", "Due Date", "Payee / Supplier", "Object of Expenditure", "Allotment Class", "UACS Code", "Description", "Total Amount", ...AGING_BUCKETS.map((b) => b.label), "Aging (Days)", "Aging Bracket"];
  const detail: XlsxCell[][] = [
    ...intro(AUO_TITLE),
    head,
    ...report.rows.map((r, i): XlsxCell[] => {
      const b = bucketOf(r, report.asOf);
      return [i + 1, r.referenceNo, lasaDate(r.dateObligated), lasaDate(r.dueDate), r.payee, r.objectOfExpenditure, r.allotmentClass, r.uacsCode, r.description, r.amount, ...AGING_BUCKETS.map((x) => (x.key === b ? r.amount : 0)), daysPastDue(r, report.asOf), bucketLabel(b)];
    }),
    ["TOTAL", "", "", "", "", "", "", "", "", totals.total, ...AGING_BUCKETS.map((b) => totals[b.key])],
  ];
  const sheets: XlsxSheet[] = [{ name: "Aging Detail", rows: detail, boldRows: [0, 4, detail.length - 1], columnWidths: [6, 16, 14, 14, 26, 12, 10, 12, 26, 16, 15, 15, 15, 15, 15, 11, 14] }];
  if (opts.summary) {
    const sum: XlsxCell[][] = [...intro("Summary by Aging Bracket"), ["Aging Bracket", "Amount", "% of Total"], ...bucketSummary(totals).map((b) => [b.label, b.amount, Math.round(b.share * 10000) / 100]), ["TOTAL", totals.total, totals.total ? 100 : 0]];
    sheets.push({ name: "Aging Summary", rows: sum, boldRows: [0, 4, sum.length - 1], columnWidths: [18, 18, 12] });
  }
  if (opts.charts) {
    const obj = objectSummary(report.rows);
    const rows: XlsxCell[][] = [...intro("Unpaid Obligations by Object of Expenditure"), ["Object of Expenditure", "Amount", "% of Total"], ...obj.map((o) => [o.name, o.amount, Math.round(o.share * 10000) / 100]), ["TOTAL", totals.total, totals.total ? 100 : 0]];
    sheets.push({ name: "By Object", rows, boldRows: [0, 4, rows.length - 1], columnWidths: [44, 18, 12] });
  }
  return sheets;
}

export const auoFileName = (report: AuoReport, ext: string) => `MPC_BFARS8_Aging_Unpaid_Obligations_FY${report.fiscalYear}_${report.asOf}.${ext}`;
