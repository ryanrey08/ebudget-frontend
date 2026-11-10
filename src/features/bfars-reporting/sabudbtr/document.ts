import { formatCompactCurrency, formatCurrency, safeRatio } from "@/lib/utils/format";
import type { XlsxCell, XlsxSheet } from "@/lib/utils/xlsx";
import { MONTHS } from "../mrd/document";
import { quarterEndText, quarterLabel, quarterMonths } from "../qrror/document";
import type { SabudbtrDocOptions, SabudbtrGroupBy } from "./sabudbtrSlice";
import type { SabudbtrReport, SabudbtrRow } from "./types";

export { quarterLabel };

export const SABUDBTR_TITLE = "Statement of Approved Budget, Utilizations, Disbursements and Balances for Trust Receipts (SABUDBTR)";

/** Fund colors of the BFARS 11 mockups' donut (blue / red / green / orange / purple). */
const FUND_COLORS: Record<string, string> = {
  "Student Fees": "#2f7cf6",
  "Research Income": "#ec2027",
  "Extension Programs": "#22a045",
  "Other Income": "#f7a21b",
  "Trust Liabilities": "#9b51e0",
};
export const fundColor = (fund: string) => FUND_COLORS[fund] ?? "#6b7280";
/** Series colors of the report's grouped bar chart. */
export const SERIES = [
  { key: "approvedBudget", label: "Approved Budget", color: "#2f7cf6" },
  { key: "utilizations", label: "Utilizations", color: "#ec2027" },
  { key: "disbursements", label: "Disbursements", color: "#22a045" },
] as const;

/**
 * Totals and balances, as defined by MPC_BFARS11_SABUDBTR_Sample_Q1_2026:
 * unutilized balance = approved budget − utilizations; cash balance (the workbook's "undisbursed utilizations")
 * = utilizations − disbursements; % utilized = utilizations ÷ approved budget.
 */
export interface SabudbtrTotals {
  approvedBudget: number;
  utilizations: number;
  disbursements: number;
  unutilized: number;
  cashBalance: number;
  rate: number;
}

export function sumRows(rows: Pick<SabudbtrRow, "approvedBudget" | "utilizations" | "disbursements">[]): SabudbtrTotals {
  const approvedBudget = rows.reduce((s, r) => s + r.approvedBudget, 0);
  const utilizations = rows.reduce((s, r) => s + r.utilizations, 0);
  const disbursements = rows.reduce((s, r) => s + r.disbursements, 0);
  return { approvedBudget, utilizations, disbursements, unutilized: approvedBudget - utilizations, cashBalance: utilizations - disbursements, rate: safeRatio(utilizations, approvedBudget) };
}

export interface SabudbtrFundLine extends SabudbtrTotals {
  fund: string;
  uacsCode: string;
  uacsDescription: string;
  color: string;
  rows: SabudbtrRow[];
}

/** One line per trust receipt fund (in report order), with its activity rows. */
export function byFund(rows: SabudbtrRow[]): SabudbtrFundLine[] {
  const funds = [...new Set(rows.map((r) => r.fund))];
  return funds.map((fund) => {
    const own = rows.filter((r) => r.fund === fund);
    return { fund, uacsCode: own[0].uacsCode, uacsDescription: own[0].uacsDescription, color: fundColor(fund), rows: own, ...sumRows(own) };
  });
}

/** Each fund's utilizations and share of the total (the donut). */
export function fundShares(rows: SabudbtrRow[]) {
  const lines = byFund(rows);
  const total = lines.reduce((s, l) => s + l.utilizations, 0);
  return lines.map((l) => ({ fund: l.fund, color: l.color, amount: l.utilizations, share: safeRatio(l.utilizations, total) }));
}

/** Utilizations and disbursements per month of the quarter (the dashboard's bar chart). */
export function monthlyTotals(rows: SabudbtrRow[], quarter: SabudbtrReport["quarter"]) {
  return quarterMonths(quarter).map((m) => {
    const ms = rows.flatMap((r) => r.monthly.filter((x) => x.month === m));
    return { month: MONTHS[m - 1], utilizations: ms.reduce((s, x) => s + x.utilizations, 0), disbursements: ms.reduce((s, x) => s + x.disbursements, 0) };
  });
}

export interface SabudbtrFilterLabels {
  department: string;
  fund: string;
  uacsMajor: string;
}

const peso = (v: number) => formatCurrency(v).replace("₱", "");
const php = (v: number) => `PHP ${peso(v)}`;
const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const compact = (v: number) => formatCompactCurrency(v);
const share = (r: number) => `${(r * 100).toFixed(2)}%`;
const shareShort = (r: number) => `${(r * 100).toFixed(1)}%`;

/** A 1–2–5 step that keeps the axis to about five ticks. */
function niceStep(max: number) {
  const raw = Math.max(max, 1) / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
}

/** Approved budget, utilizations and disbursements per fund (₱ millions) with value labels, as in the report mockup. */
function fundBarsSvg(lines: SabudbtrFundLine[], title: string) {
  const W = 430, H = 190, left = 36, bottom = 140, top = 14;
  const peak = Math.max(0, ...lines.flatMap((l) => SERIES.map((s) => l[s.key])));
  const step = niceStep(peak);
  const max = Math.max(step, Math.ceil(peak / step) * step);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const slot = (W - left) / Math.max(lines.length, 1);
  const w = Math.min(slot * 0.24, 26);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const words = (s: string) => s.split(" ");
  const bars = lines
    .map((l, i) => {
      const x0 = left + i * slot + (slot - w * 3) / 2;
      const label = words(l.fund).map((wd, k) => `<tspan x="${x0 + 1.5 * w}" dy="${k ? 9 : 0}">${esc(wd)}</tspan>`).join("");
      return (
        SERIES.map((s, j) => {
          const v = l[s.key];
          const x = x0 + j * w;
          return `<rect x="${x}" y="${y(v)}" width="${w - 2}" height="${bottom - y(v)}" fill="${s.color}"/>${v ? `<text x="${x + (w - 2) / 2}" y="${y(v) - 3}" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#1e3a8a">${esc(compact(v))}</text>` : ""}`;
        }).join("") + `<text y="${bottom + 11}" text-anchor="middle" font-size="7.5" fill="#1e3a8a">${label}</text>`
      );
    })
    .join("");
  const offsets = [0, 110, 200];
  const legend = SERIES.map((s, i) => `<rect x="${left + 50 + offsets[i]}" y="${H - 9}" width="7" height="7" fill="${s.color}"/><text x="${left + 60 + offsets[i]}" y="${H - 3}" font-size="7.5" fill="#1e3a8a">${s.label}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="188" role="img" aria-label="${esc(title)}">
<text x="9" y="${(top + bottom) / 2}" transform="rotate(-90 9 ${(top + bottom) / 2})" text-anchor="middle" font-size="7.5" fill="#374151">Amount (₱ Millions)</text>
${ticks.map((v) => `<line x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e7eb"/><text x="${left - 5}" y="${y(v) + 3}" text-anchor="end" font-size="7.5" fill="#374151">${v ? +(v / 1_000_000).toFixed(1) : "0"}</text>`).join("")}
${bars}${legend}</svg>`;
}

/** Donut of utilizations by fund, with its legend. */
function donutSvg(rows: SabudbtrRow[], total: number) {
  const groups = fundShares(rows);
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
      const label = g.share >= 0.04 ? `<text x="${cx + ((R + r) / 2) * Math.cos(mid)}" y="${cy + ((R + r) / 2) * Math.sin(mid) + 3}" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#fff">${shareShort(g.share)}</text>` : "";
      return path + label;
    })
    .join("");
  const center = `<text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e3a8a">${esc(compact(total))}</text><text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="6.5" fill="#1e3a8a">Total</text><text x="${cx}" y="${cy + 17}" text-anchor="middle" font-size="6.5" fill="#1e3a8a">Utilizations</text>`;
  const legend = `<table class="legend">${groups.map((g) => `<tr><td><i style="background:${g.color}"></i></td><td>${esc(g.fund)}</td><td class="n">${shareShort(g.share)}</td><td class="n">₱ ${peso(g.amount)}</td></tr>`).join("") || `<tr><td>No utilizations.</td></tr>`}</table>`;
  return `<div class="donut"><svg viewBox="0 0 124 124" width="150" height="150" role="img" aria-label="Utilizations by trust receipt fund">${total ? arcs : `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="#e5e7eb" stroke-width="${R - r}"/>`}${center}</svg>${legend}</div>`;
}

// Page layout in millimetres (A4 landscape, 190 mm of usable height under the margins).
const BODY_MM = 188;
const HEADER_MM = 22;
const ROW_MM = 5.0;
const HEAD_MM = 10;
const TITLE_MM = 9;

type Block = { html: string; mm: number } | { title?: string; head: string; rows: string[]; foot?: string; cls: string; newPage?: boolean };

/** Flows blocks onto pages; tables split across pages and repeat their header. */
function paginate(blocks: Block[], header: string) {
  const pages: string[] = [];
  let room = 0;
  const fresh = BODY_MM - HEADER_MM;
  const newPage = () => {
    pages.push(header);
    room = fresh;
  };
  newPage();
  for (const b of blocks) {
    if ("html" in b) {
      if (b.mm > room && room < fresh) newPage();
      pages[pages.length - 1] += b.html;
      room -= b.mm;
      continue;
    }
    if (b.newPage && room < fresh) newPage();
    const titleMm = b.title ? TITLE_MM : 0;
    let i = 0;
    let first = true;
    while (i < b.rows.length || first) {
      const need = titleMm + HEAD_MM + ROW_MM * Math.min(3, Math.max(1, b.rows.length - i));
      if (need > room && room < fresh) newPage();
      const fit = Math.max(1, Math.floor((room - titleMm - HEAD_MM - (b.foot ? ROW_MM : 0)) / ROW_MM));
      const chunk = b.rows.slice(i, i + fit);
      i += chunk.length;
      const last = i >= b.rows.length;
      const title = b.title ? `<h3 class="sec">${esc(b.title)}${first ? "" : " (continued)"}</h3>` : first ? "" : `<p class="cont">(continued)</p>`;
      pages[pages.length - 1] += `${title}<table class="${b.cls}">${b.head}<tbody>${chunk.join("")}</tbody>${last && b.foot ? b.foot : ""}</table>`;
      room -= titleMm + HEAD_MM + (chunk.length + (last && b.foot ? 1 : 0)) * ROW_MM;
      first = false;
    }
  }
  return pages;
}

/** Statement rows: one per fund, or each fund's activities with a subtotal ("Fund / Activity"). */
function statementRows(rows: SabudbtrRow[], groupBy: SabudbtrGroupBy, withRate: boolean) {
  const cells = (t: SabudbtrTotals) =>
    `<td class="n">${peso(t.approvedBudget)}</td><td class="n">${peso(t.utilizations)}</td><td class="n">${peso(t.disbursements)}</td><td class="n">${peso(t.unutilized)}</td><td class="n">${peso(t.cashBalance)}</td>${withRate ? `<td class="n">${share(t.rate)}</td>` : ""}`;
  const span = withRate ? 9 : 8;
  return byFund(rows).flatMap((l) =>
    groupBy === "fund"
      ? [`<tr><td>${esc(l.fund)}</td><td class="c">${esc(l.uacsCode)}</td><td>${esc(l.uacsDescription)}</td>${cells(l)}</tr>`]
      : [
          `<tr class="grp"><td colspan="${span}">${esc(l.fund)} (${esc(l.uacsCode)} – ${esc(l.uacsDescription)})</td></tr>`,
          ...l.rows.map((r) => `<tr><td class="ind">${esc(r.activity)}</td><td class="c">${esc(r.uacsCode)}</td><td>${esc(r.office)}</td>${cells(sumRows([r]))}</tr>`),
          `<tr class="sub"><td colspan="3">Subtotal – ${esc(l.fund)}</td>${cells(l)}</tr>`,
        ],
  );
}

/** Printable BFARS 11 report (HTML pages), used for the preview, PDF (print) and download. */
export function buildSabudbtrDocument(
  report: SabudbtrReport,
  opts: SabudbtrDocOptions,
  groupBy: SabudbtrGroupBy,
  labels: SabudbtrFilterLabels,
  ctx: { logoUrl: string; generatedAt: string },
) {
  const { fiscalYear, quarter, rows } = report;
  const t = sumRows(rows);
  const lines = byFund(rows);
  const qText = quarterLabel(fiscalYear, quarter);
  const qShort = `Q${quarter.slice(1)} ${fiscalYear}`;
  const withRate = opts.percentUtilized;

  const header = `<div class="hdr"><img src="${esc(ctx.logoUrl)}" alt=""/><div class="org">Republic of the Philippines<br/><b>${esc(report.agency.toUpperCase())}</b><br/>Sta. Elena, Marikina City</div><div class="form">BFARS Form 11<br/>Annex K</div></div>`;
  const paramRows: [string, string][] = [
    ["Department/Office", labels.department],
    ["Trust Receipt Fund", labels.fund],
    ["UACS (Major)", labels.uacsMajor],
  ];
  const title = `<div class="title"><h1>STATEMENT OF APPROVED BUDGET, UTILIZATIONS, DISBURSEMENTS AND BALANCES<br/>FOR TRUST RECEIPTS (SABUDBTR)</h1><p>For the Quarter Ending ${esc(quarterEndText(fiscalYear, quarter))}<br/>(Fiscal Year ${fiscalYear})</p></div><table class="params">${paramRows.map(([k, v]) => `<tr><td>${k}</td><td>:</td><td>${esc(v)}</td></tr>`).join("")}</table>`;
  const blocks: Block[] = [{ html: title, mm: 30 }];

  if (opts.summary) {
    const first = groupBy === "fund" ? ["Fund / Trust<br/>Receipt", "UACS<br/>Code", "UACS Description"] : ["Fund / Activity", "UACS<br/>Code", "Department/Office"];
    const head = `<thead><tr>${[...first, "Approved<br/>Budget<br/>(₱)", "Utilizations<br/>(₱)", "Disbursements<br/>(₱)", "Unutilized<br/>Balance<br/>(₱)", "Cash Balance<br/>(₱)", ...(withRate ? ["% Utilized"] : [])].map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
    const body = statementRows(rows, groupBy, withRate);
    if (!body.length) body.push(`<tr><td colspan="${withRate ? 9 : 8}" class="c">No trust receipts match the selected parameters.</td></tr>`);
    const foot = `<tfoot><tr><td colspan="3" class="c">TOTAL</td><td class="n">${peso(t.approvedBudget)}</td><td class="n">${peso(t.utilizations)}</td><td class="n">${peso(t.disbursements)}</td><td class="n">${peso(t.unutilized)}</td><td class="n">${peso(t.cashBalance)}</td>${withRate ? `<td class="n">${share(t.rate)}</td>` : ""}</tr></tfoot>`;
    blocks.push({ head, rows: body, foot, cls: "stmt" });
    blocks.push({
      html: `<p class="recon"><b>Reconciliation:</b> Approved Budget ${php(t.approvedBudget)} less Utilizations ${php(t.utilizations)} = Unutilized Balance ${php(t.unutilized)}. Utilizations less Disbursements ${php(t.disbursements)} = Cash Balance (undisbursed utilizations) ${php(t.cashBalance)}.</p>`,
      mm: 4,
    });
    blocks.push({
      html: `<div class="panels"><div class="panel"><h3>Budget, Utilizations and Disbursements (${esc(qShort)})</h3><div class="pbody">${fundBarsSvg(lines, `Budget, utilizations and disbursements by fund, ${qShort}`)}</div></div><div class="panel"><h3>Utilizations by Trust Receipt Fund (${esc(qShort)})</h3><div class="pbody">${donutSvg(rows, t.utilizations)}</div></div></div>`,
      mm: 62,
    });
  }

  if (opts.signatories) {
    blocks.push({
      html: `<div class="sigs">${report.signatories.map((s) => `<div><p>${esc(s.role)}:</p><div class="line"></div><b>${esc(s.name.toUpperCase())}</b><span>${esc(s.position)}</span><p class="date">Date: <i></i></p></div>`).join("")}</div>`,
      mm: 28,
    });
  }

  if (opts.previousQuarter) {
    const prev = report.previousQuarter;
    const prevLines = prev ? byFund(prev.rows) : [];
    const head = `<thead><tr><th rowspan="2">Fund / Trust Receipt</th><th colspan="3">Utilizations (₱)</th><th colspan="3">Disbursements (₱)</th><th colspan="2">% Utilized</th></tr><tr><th>${esc(prev?.label ?? "Previous Quarter")}</th><th>${esc(qShort)}</th><th>Increase / (Decrease)</th><th>${esc(prev?.label ?? "Previous Quarter")}</th><th>${esc(qShort)}</th><th>Increase / (Decrease)</th><th>${esc(prev?.label ?? "Previous")}</th><th>${esc(qShort)}</th></tr></thead>`;
    const diff = (v: number) => (v < 0 ? `(${peso(-v)})` : peso(v));
    const line = (c: SabudbtrTotals, p: SabudbtrTotals) =>
      `<td class="n">${peso(p.utilizations)}</td><td class="n">${peso(c.utilizations)}</td><td class="n">${diff(c.utilizations - p.utilizations)}</td><td class="n">${peso(p.disbursements)}</td><td class="n">${peso(c.disbursements)}</td><td class="n">${diff(c.disbursements - p.disbursements)}</td><td class="n">${share(p.rate)}</td><td class="n">${share(c.rate)}</td>`;
    const zero = sumRows([]);
    const body = prev
      ? lines.map((l) => `<tr><td>${esc(l.fund)}</td>${line(l, prevLines.find((p) => p.fund === l.fund) ?? zero)}</tr>`)
      : [`<tr><td colspan="9" class="c">No data is available for the previous quarter.</td></tr>`];
    const foot = prev ? `<tfoot><tr><td class="c">TOTAL</td>${line(t, sumRows(prev.rows))}</tr></tfoot>` : "";
    blocks.push({ title: `Comparative Statement — ${qShort} vs. ${prev?.label ?? "Previous Quarter"} (year-to-date as of each quarter end)`, head, rows: body, foot, cls: "cmp" });
  }

  if (opts.details) {
    const months = quarterMonths(quarter);
    const mHead = months.map((m) => `<th>${MONTHS[m - 1]}</th>`).join("");
    const head = `<thead><tr><th rowspan="2">Fund / Activity</th><th rowspan="2">Department/Office</th><th colspan="4">Utilizations (₱)</th><th colspan="4">Disbursements (₱)</th></tr><tr>${mHead}<th>Quarter Total</th>${mHead}<th>Quarter Total</th></tr></thead>`;
    const monthCells = (rs: SabudbtrRow[]) => {
      const sum = (m: number, k: "utilizations" | "disbursements") => rs.reduce((s, r) => s + (r.monthly.find((x) => x.month === m)?.[k] ?? 0), 0);
      const part = (k: "utilizations" | "disbursements") => {
        const vals = months.map((m) => sum(m, k));
        return vals.map((v) => `<td class="n">${peso(v)}</td>`).join("") + `<td class="n b">${peso(vals.reduce((a, b) => a + b, 0))}</td>`;
      };
      return part("utilizations") + part("disbursements");
    };
    const body = lines.flatMap((l) => [
      `<tr class="grp"><td colspan="10">${esc(l.fund)} (${esc(l.uacsCode)} – ${esc(l.uacsDescription)})</td></tr>`,
      ...l.rows.map((r) => `<tr><td class="ind">${esc(r.activity)}</td><td>${esc(r.office)}</td>${monthCells([r])}</tr>`),
      `<tr class="sub"><td colspan="2">Subtotal – ${esc(l.fund)}</td>${monthCells(l.rows)}</tr>`,
    ]);
    if (!body.length) body.push(`<tr><td colspan="10" class="c">No trust receipts match the selected parameters.</td></tr>`);
    const foot = `<tfoot><tr><td colspan="2" class="c">TOTAL</td>${monthCells(rows)}</tr></tfoot>`;
    // The monthly breakdown starts on its own page after the statement, as the workbook's "Monthly Utilization" sheet.
    blocks.push({ title: `Detailed Transactions — Monthly Utilizations and Disbursements (${qText})`, head, rows: body, foot, cls: "detail", newPage: opts.summary || opts.previousQuarter });
  }

  const pages = paginate(blocks, header);
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>BFARS 11 – SABUDBTR ${esc(qText)}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:9px}
.page{position:relative;width:297mm;height:210mm;margin:12px auto;background:#fff;padding:7mm 9mm 13mm;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.2);page-break-after:always}
.hdr{display:grid;grid-template-columns:90px 1fr 120px;align-items:start;gap:10px;height:20mm}.hdr img{width:64px;height:64px;object-fit:contain;margin-left:14px}.org{text-align:center;font-size:10.5px;line-height:1.4}.org b{font-size:12px}.form{text-align:right;font-weight:bold;font-size:11.5px;line-height:1.5}
.title{text-align:center;margin:0 0 2px}h1{font-size:14.5px;margin:0 0 3px;line-height:1.3}.title p{margin:0;font-size:11px;line-height:1.35}h3{font-size:11px;margin:0}h3.sec{color:#1e3a8a;margin:8px 0 4px}.cont{margin:4px 0;color:#6b7280}
.params{width:auto;border-collapse:collapse;margin:0 0 5px}.params td{border:0;padding:0.5px 6px 0.5px 0;font-size:9.5px}.params td:first-child{font-weight:bold;width:120px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #bfd3ea;padding:2.5px 4px;text-align:left;vertical-align:middle}th{background:#dbeafe;font-size:8.5px;text-align:center;color:#1e293b;font-weight:bold}td.n{text-align:right;white-space:nowrap}td.c{text-align:center}td.b{font-weight:bold}td.ind{padding-left:12px}
.stmt td{font-size:9px;padding:4px 5px}.detail td{white-space:nowrap;font-size:8.5px}.cmp td{font-size:9px}
tr.grp td{background:#eff6ff;font-weight:bold;color:#1e3a8a}tr.sub td{font-weight:bold;background:#f8fafc}tr.sub td:first-child{text-align:right}
tfoot td{font-weight:bold;background:#cfe2fb;padding:4px 5px}
.recon{margin:5px 0 0;font-size:8.5px;color:#1f2937}
.panels{display:grid;grid-template-columns:1.15fr 1fr;gap:9px;margin-top:6px}
.panel{border:1px solid #bfd3ea;border-radius:3px;overflow:hidden}.panel h3{color:#1d4ed8;padding:5px 8px 0;font-size:10.5px}.pbody{padding:2px 6px 4px}
.donut{display:flex;align-items:center;gap:8px}.legend{width:auto;flex:1}.legend td{border:0;padding:4px 3px;font-size:8.5px;color:#1e3a8a}.legend i{display:inline-block;width:8px;height:8px;border-radius:50%}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:10px}.sigs p{margin:0;font-weight:bold}.sigs .line{border-bottom:1px solid #111;height:20px;margin:0 30px 3px}.sigs b,.sigs span{display:block;text-align:center}.sigs span{font-size:9px}.sigs .date{margin:6px 0 0 30px;font-weight:normal}.sigs .date i{display:inline-block;width:150px;border-bottom:1px solid #111}
footer{position:absolute;left:9mm;right:9mm;bottom:5mm;display:flex;justify-content:space-between;color:#6b7280;font-size:7.5px;border-top:1px solid #e5e7eb;padding-top:3px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none}}
</style></head><body>${pages
    .map((pg, i) => `<section class="page" id="page-${i + 1}">${pg}<footer>${esc(report.agency)} • BFARS 11 – SABUDBTR • ${esc(report.period)} • Generated ${esc(ctx.generatedAt)}<span>Page ${i + 1} of ${pages.length}</span></footer></section>`)
    .join("")}</body></html>`;
  return { html, pageCount: pages.length };
}

/** Workbook sheets ("BFARS 11 Summary" and "Monthly Utilization" as in the sample workbook, plus the comparison). */
export function buildSabudbtrSheets(report: SabudbtrReport, opts: SabudbtrDocOptions, groupBy: SabudbtrGroupBy, labels: SabudbtrFilterLabels): XlsxSheet[] {
  const { fiscalYear, quarter, rows } = report;
  const t = sumRows(rows);
  const lines = byFund(rows);
  const qShort = `Q${quarter.slice(1)} ${fiscalYear}`;
  const withRate = opts.percentUtilized;
  const rate = (r: number) => Math.round(r * 10000) / 100;
  const intro = (title: string): XlsxCell[][] => [
    [`BFARS 11 – ${title}`],
    [`${report.agency} • For the Quarter Ending ${quarterEndText(fiscalYear, quarter)} • Fiscal Year ${fiscalYear}`],
    [`Department/Office: ${labels.department} • Trust Receipt Fund: ${labels.fund} • UACS (Major): ${labels.uacsMajor}`],
    [],
  ];
  const amounts = (x: SabudbtrTotals): XlsxCell[] => [x.approvedBudget, x.utilizations, x.disbursements, x.unutilized, x.cashBalance, ...(withRate ? [rate(x.rate)] : [])];
  const sheets: XlsxSheet[] = [];

  if (opts.summary || (!opts.details && !opts.previousQuarter)) {
    const head = [groupBy === "fund" ? "Fund / Trust Receipt" : "Fund / Activity", "UACS Code", groupBy === "fund" ? "UACS Description" : "Department/Office", "Approved Budget (PHP)", "Utilizations (PHP)", "Disbursements (PHP)", "Unutilized Balance (PHP)", "Cash Balance (PHP)", ...(withRate ? ["% Utilized"] : [])];
    const body: XlsxCell[][] =
      groupBy === "fund"
        ? lines.map((l) => [l.fund, l.uacsCode, l.uacsDescription, ...amounts(l)])
        : lines.flatMap((l) => [[`${l.fund} (${l.uacsCode} – ${l.uacsDescription})`], ...l.rows.map((r): XlsxCell[] => [`  ${r.activity}`, r.uacsCode, r.office, ...amounts(sumRows([r]))]), [`Subtotal – ${l.fund}`, "", "", ...amounts(l)]]);
    const out: XlsxCell[][] = [
      ...intro(SABUDBTR_TITLE),
      head,
      ...body,
      ["TOTAL", "", "", ...amounts(t)],
      [],
      [`Reconciliation: Approved Budget less Utilizations = Unutilized Balance (${peso(t.unutilized)}); Utilizations less Disbursements = Cash Balance / undisbursed utilizations (${peso(t.cashBalance)}).`],
    ];
    sheets.push({ name: "BFARS 11 Summary", rows: out, boldRows: [0, 4, 5 + body.length], columnWidths: [34, 13, 30, 20, 18, 18, 20, 18, 11] });
  }

  if (opts.previousQuarter && report.previousQuarter) {
    const prev = report.previousQuarter;
    const prevLines = byFund(prev.rows);
    const zero = sumRows([]);
    const line = (c: SabudbtrTotals, p: SabudbtrTotals): XlsxCell[] => [p.utilizations, c.utilizations, c.utilizations - p.utilizations, p.disbursements, c.disbursements, c.disbursements - p.disbursements, rate(p.rate), rate(c.rate)];
    const out: XlsxCell[][] = [
      ...intro(`Comparative Statement — ${qShort} vs. ${prev.label}`),
      ["Fund / Trust Receipt", `Utilizations ${prev.label}`, `Utilizations ${qShort}`, "Increase / (Decrease)", `Disbursements ${prev.label}`, `Disbursements ${qShort}`, "Increase / (Decrease)", `% Utilized ${prev.label}`, `% Utilized ${qShort}`],
      ...lines.map((l) => [l.fund, ...line(l, prevLines.find((p) => p.fund === l.fund) ?? zero)]),
      ["TOTAL", ...line(t, sumRows(prev.rows))],
    ];
    sheets.push({ name: "Previous Quarter", rows: out, boldRows: [0, 4, out.length - 1], columnWidths: [24, 18, 18, 18, 18, 18, 18, 12, 12] });
  }

  if (opts.details) {
    const months = quarterMonths(quarter);
    const vals = (rs: SabudbtrRow[], k: "utilizations" | "disbursements") => {
      const v = months.map((m) => rs.reduce((s, r) => s + (r.monthly.find((x) => x.month === m)?.[k] ?? 0), 0));
      return [...v, v.reduce((a, b) => a + b, 0)];
    };
    const out: XlsxCell[][] = [
      ...intro(`Monthly Utilizations and Disbursements — ${quarterLabel(fiscalYear, quarter)}`),
      ["Fund / Activity", "Department/Office", ...months.map((m) => `${MONTHS[m - 1]} Utilization`), "Quarter Utilization", ...months.map((m) => `${MONTHS[m - 1]} Disbursement`), "Quarter Disbursement"],
      ...lines.flatMap((l) => [[l.fund], ...l.rows.map((r): XlsxCell[] => [`  ${r.activity}`, r.office, ...vals([r], "utilizations"), ...vals([r], "disbursements")]), [`Subtotal – ${l.fund}`, "", ...vals(l.rows, "utilizations"), ...vals(l.rows, "disbursements")]]),
      ["TOTAL", "", ...vals(rows, "utilizations"), ...vals(rows, "disbursements")],
    ];
    sheets.push({ name: "Monthly Utilization", rows: out, boldRows: [0, 4, out.length - 1], columnWidths: [36, 24, 16, 16, 16, 18, 16, 16, 16, 18] });
  }
  return sheets;
}

export const sabudbtrFileName = (report: SabudbtrReport, ext: string) => `MPC_BFARS11_SABUDBTR_FY${report.fiscalYear}_${report.quarter}.${ext}`;
