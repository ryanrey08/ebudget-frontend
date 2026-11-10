"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChartColumnBig, ChartPie, FileSpreadsheet, FileText, Filter, HandHeart, Landmark, PhilippinePeso, Printer, ReceiptText, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart } from "@/components/charts/DonutChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { SearchInput } from "@/components/shared/SearchInput";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { cn } from "@/lib/utils/cn";
import { buildXlsx } from "@/lib/utils/xlsx";
import { formatCompactCurrency, formatCurrency, formatDateTime, formatPercent } from "@/lib/utils/format";
import { useGetQrrorReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { lasaDate } from "../lasa/document";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { QuarterTrendChart } from "./QrrorCharts";
import { buildQrrorDocument, buildQrrorSheets, changeRatio, className, classSummary, monthlyByClass, qrrorFileName, quarterLabel, splitPeriods, sumByClass, type QrrorDocOptions } from "./document";
import { QrrorFields, changeQrrorParam, emptyQrrorParams, qrrorFilterLabels, validateQrrorParams, type QrrorField } from "./QrrorParamFields";
import type { Quarter } from "../qpro/types";
import type { QrrorParams, QrrorRow } from "./types";

export const QRROR_GENERATE_HREF = "/bfars-reporting/bfars-10/generate";
export const QRROR_PAGE_TITLE = "BFARS 10 – Quarterly Report of Revenue and Other Receipts (QRROR)";
const ALL_OPTIONS: QrrorDocOptions = { summary: true, details: true, groupByClass: false, previousQuarter: true, signatories: true };
const HEADERS = ["#", "Date", "Reference No.", "Revenue Classification", "UACS Code", "Description", "Amount (₱)"];
const CARD_ICONS: Record<string, { icon: LucideIcon; bg: string }> = {
  "4-01": { icon: ReceiptText, bg: "bg-blue-600" },
  "4-02": { icon: ChartColumnBig, bg: "bg-amber-400" },
  "4-03": { icon: HandHeart, bg: "bg-purple-600" },
};

const matches = (r: QrrorRow, q: string) =>
  !q || [r.referenceNo, r.description, r.uacsCode, className(r.classification), r.office].some((v) => v.toLowerCase().includes(q));

/** "▲ 12.5%  vs. Q1 2025 (₱75,555,000.00)" under the total (same quarter of the previous fiscal year). */
function Change({ current, previous, label }: { current: number; previous: number | null; label: string | null }) {
  if (previous === null || !label) return <p className="mt-1 text-xs text-gray-500">No data for the previous fiscal year</p>;
  const ratio = changeRatio(current, previous);
  if (ratio === null) return <p className="mt-1 text-xs text-gray-500">No receipts in {label}</p>;
  const up = ratio >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-600">
      <span className={cn("flex items-center gap-1 text-[13px] font-semibold tabular-nums", up ? "text-green-700" : "text-red-600")}><Icon className="size-3.5" aria-hidden />{formatPercent(Math.abs(ratio), 1)}</span>
      <span className="whitespace-nowrap">vs. {label} ({formatCurrency(previous)})</span>
    </p>
  );
}

function KpiCard({ icon: Icon, iconBg, label, value, loading, children }: { icon: LucideIcon; iconBg: string; label: string; value: string; loading: boolean; children?: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full text-white", iconBg)}><Icon className="size-7" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-tight text-blue-900">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-10 w-full" />
        ) : (
          <>
            <p className="mt-1 text-lg font-bold tracking-tight whitespace-nowrap text-blue-900 tabular-nums" title={value}>{value}</p>
            {children}
          </>
        )}
      </div>
    </Card>
  );
}

function ShareBar({ label, share, color }: { label: string; share: number; color: string }) {
  return (
    <>
      <p className="mt-0.5 text-[13px] text-gray-700 tabular-nums">{formatPercent(share, 2)}</p>
      <div role="progressbar" aria-label={`${label} share of total revenue and other receipts`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: color }} />
      </div>
    </>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-semibold text-blue-900">
      <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white"><Icon className="size-4" aria-hidden /></span>
      {children}
    </h2>
  );
}

/** BFARS 10 – Quarterly Report of Revenue and Other Receipts page: parameters, KPIs, monthly and classification charts, and the quarter's receipts. */
export function QrrorView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const [draft, setDraft] = useState<QrrorParams>(() => emptyQrrorParams(fy));
  const [applied, setApplied] = useState<QrrorParams>(() => emptyQrrorParams(fy));
  const [errors, setErrors] = useState<Partial<Record<QrrorField, string>>>({});
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetQrrorReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: QrrorField, value: string) => {
    setDraft((d) => changeQrrorParam(d, field, value));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const announce = useRef(false);
  const generate = async () => {
    const errs = validateQrrorParams(draft);
    setErrors(errs);
    if (Object.keys(errs).length) {
      notify("error", "Unable to generate the report", "Complete the required parameters.");
      return;
    }
    announce.current = true;
    if (JSON.stringify(draft) === JSON.stringify(applied)) await refetch();
    else setApplied(draft);
  };

  const fiscalYear = data?.fiscalYear ?? applied.fiscalYear;
  const quarter: Quarter = data?.quarter ?? (applied.quarter || "Q1");
  const rows = useMemo(() => splitPeriods(data?.rows ?? [], quarter).current, [data, quarter]);
  useEffect(() => {
    if (!announce.current || isFetching) return;
    announce.current = false;
    if (error) notify("error", "Unable to generate the report", "Check the parameters and try again.");
    else if (data) notify(rows.length ? "success" : "warning", rows.length ? "Report generated" : "No receipts", `BFARS 10, ${quarterLabel(data.fiscalYear, data.quarter)}.`);
  }, [isFetching, data, error, notify, rows.length]);

  const filtered = useMemo(() => rows.filter((r) => matches(r, search.trim().toLowerCase())), [rows, search]);
  const { pageItems, page, pageSize, total, setPage, setPageSize } = useClientPagination(filtered, 10);
  const cur = sumByClass(rows);
  const classes = classSummary(cur);
  const trend = useMemo(() => monthlyByClass(rows, quarter), [rows, quarter]);
  const labels = qrrorFilterLabels(applied, data?.options);
  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0);
  const qText = quarterLabel(fiscalYear, quarter);
  const qShort = `Q${quarter.slice(1)} ${fiscalYear}`;
  const prevYear = data?.previousYear ? sumByClass(data.previousYear.rows).total : null;

  const exportExcel = () => {
    if (!data) return;
    downloadFile(qrrorFileName(data, "xlsx"), buildXlsx(buildQrrorSheets(data, ALL_OPTIONS, labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", qrrorFileName(data, "xlsx"));
  };
  const printReport = (asPdf: boolean) => {
    if (!data) return;
    try {
      printDocument(buildQrrorDocument(data, ALL_OPTIONS, labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      if (asPdf) notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", asPdf ? "Unable to export" : "Unable to print", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const money = (v: number) => formatCurrency(v).replace("₱", "");

  return (
    <>
      <PageHeader
        title={QRROR_PAGE_TITLE}
        description="View and generate the official BFARS 10 report showing quarterly revenue and other receipts."
        extraCrumbs={["Quarterly Report of Revenue and Other Receipts"]}
        actions={<Link href={QRROR_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 10 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <QrrorFields params={draft} onChange={onChange} options={data?.options} errors={errors} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 lg:self-end xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <KpiCard icon={PhilippinePeso} iconBg="bg-green-600" label="Total Revenue and Other Receipts" value={formatCurrency(cur.total)} loading={loading}>
              <Change current={cur.total} previous={prevYear} label={data?.previousYear?.label ?? null} />
            </KpiCard>
            {classes.map((c) => (
              <KpiCard key={c.code} icon={CARD_ICONS[c.code].icon} iconBg={CARD_ICONS[c.code].bg} label={c.name} value={formatCurrency(c.amount)} loading={loading}>
                <ShareBar label={c.name} share={c.share} color={c.cardColor} />
              </KpiCard>
            ))}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <SectionTitle icon={ChartColumnBig}>Quarterly Revenue Trend (FY {fiscalYear})</SectionTitle>
              {loading ? <Skeleton className="mt-4 h-64 w-full" /> : <div className="mt-3"><QuarterTrendChart data={trend} /></div>}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={ChartPie}>Revenue and Other Receipts by Classification ({qShort})</SectionTitle>
              {loading ? (
                <Skeleton className="mt-4 h-64 w-full" />
              ) : (
                <div className="mt-3 grid items-center gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
                  <DonutChart height={250} data={classes.map((c) => ({ name: c.name, value: c.amount, color: c.color }))} centerValue={formatCompactCurrency(cur.total)} centerLabel="Total Revenue" />
                  <ul className="space-y-4 text-[13px]">
                    {classes.map((c) => (
                      <li key={c.code} className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem_auto] items-center gap-x-2.5">
                        <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                        <span className="text-blue-900">{c.name}</span>
                        <span className="text-right text-gray-700 tabular-nums">{formatPercent(c.share, 2)}</span>
                        <span className="text-right font-medium text-blue-900 tabular-nums">{formatCurrency(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
              <SectionTitle icon={Landmark}>Revenue and Other Receipts Details</SectionTitle>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={() => printReport(true)} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => printReport(false)} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="no-print flex justify-end px-5 py-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search reference no., description…" label="Search receipts" className="w-full sm:w-80" />
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !filtered.length ? (
              <EmptyState
                title={rows.length ? "No receipts match your search" : "No receipts found"}
                description={rows.length ? "Try another reference number or description." : `No revenue or other receipts are recorded for the ${qText} with the selected parameters. Change the filters and generate the report again.`}
              />
            ) : (
              <>
                <div className="overflow-x-auto px-5">
                  <table className="w-full min-w-[900px] border border-gray-200 text-[13px]">
                    <caption className="sr-only">Revenue and other receipts, {qText}</caption>
                    <thead className="bg-blue-50/70 text-gray-900">
                      <tr>
                        {HEADERS.map((h, i) => (
                          <th key={h} scope="col" className={cn("border-b border-gray-200 px-2 py-2.5 text-xs font-semibold", i === 6 ? "text-right" : i === 3 || i === 5 ? "text-left" : "text-center")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems?.map((r, i) => (
                        <tr key={r.referenceNo} className="border-t border-gray-100 hover:bg-gray-50/60">
                          <td className="px-2 py-2 text-center text-gray-600">{(page - 1) * pageSize + i + 1}</td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">{lasaDate(r.date)}</td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">{r.referenceNo}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{className(r.classification)}</td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">{r.uacsCode}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.description}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{money(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-100/70 font-bold text-gray-900">
                        <td colSpan={6} className="px-2 py-2.5 text-center">{search.trim() ? "TOTAL (search results)" : "TOTAL"}</td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{money(filteredTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} pageSizeOptions={[10, 25, 50]} onPageSizeChange={setPageSize} />
              </>
            )}
          </Card>
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}. UACS codes are placeholders from the sample workbook; the comparison is with the same quarter of the previous fiscal year.</p>}
        </>
      )}
    </>
  );
}
