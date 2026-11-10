"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChartColumn, ChartPie, Cog, FileSpreadsheet, FileText, Filter, Grip, HandCoins, Landmark, NotepadText, Printer, type LucideIcon } from "lucide-react";
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
import { formatCompactCurrency, formatCurrency, formatDateTime, formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetMrdReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { lasaDate } from "../lasa/document";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { MonthlyTrendChart } from "./MrdCharts";
import { buildMrdDocument, buildMrdSheets, changeRatio, classSummary, monthLabel, monthlyTrend, mrdFileName, splitPeriods, sumByClass, type MrdDocOptions } from "./document";
import { MrdFields, changeMrdParam, emptyMrdParams, mrdFilterLabels, validateMrdParams, type MrdField } from "./MrdParamFields";
import type { MrdParams, MrdRow } from "./types";

export const MRD_GENERATE_HREF = "/bfars-reporting/bfars-9/generate";
export const MRD_PAGE_TITLE = "BFARS 9 – Monthly Report of Disbursement (MRD)";
const ALL_OPTIONS: MrdDocOptions = { summary: true, details: true, groupByUacs: false, previousMonth: false, fundSource: true, signatories: true };
const HEADERS = ["#", "Voucher/Reference No.", "Date", "Payee / Supplier", "UACS Code", "Object of Expenditure", "Allotment Class", "Description", "Disbursement Amount (₱)", "Fund Source"];

const matches = (r: MrdRow, q: string) =>
  !q || [r.referenceNo, r.payee, r.description, r.uacsCode, r.objectOfExpenditure, r.allotmentClass, r.fundSource].some((v) => v.toLowerCase().includes(q));

/** "▲ 12.5%  vs. February 2026" under a KPI (nothing to compare in January or after an empty month). */
function Change({ ratio, against }: { ratio: number | null; against: string | null }) {
  if (!against) return <p className="mt-1 text-xs text-gray-500">No previous month in the fiscal year</p>;
  if (ratio === null) return <p className="mt-1 text-xs text-gray-500">No disbursements in {against}</p>;
  const up = ratio >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <>
      <p className={cn("mt-1 flex items-center gap-1 text-[13px] font-medium tabular-nums", up ? "text-green-700" : "text-red-600")}><Icon className="size-3.5" aria-hidden />{formatPercent(Math.abs(ratio), 1)}</p>
      <p className="text-xs whitespace-nowrap text-gray-600">vs. {against}</p>
    </>
  );
}

function KpiCard({ icon: Icon, iconBg, label, value, loading, children }: { icon: LucideIcon; iconBg: string; label: string; value: string; loading: boolean; children?: React.ReactNode }) {
  return (
    <Card className="flex items-start gap-3 p-3.5 2xl:gap-2.5 2xl:p-3">
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full text-white 2xl:size-10", iconBg)}><Icon className="size-6 2xl:size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-tight text-blue-900 2xl:text-xs min-[1700px]:text-[13px]">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-10 w-full" />
        ) : (
          <>
            <p className="mt-0.5 text-[15px] font-bold tracking-tight whitespace-nowrap text-blue-900 tabular-nums min-[1700px]:text-base" title={value}>{value}</p>
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
      <p className="mt-1 text-[13px] text-gray-700 tabular-nums">{formatPercent(share, 2)}</p>
      <div role="progressbar" aria-label={`${label} share of total disbursements`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
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

/** BFARS 9 – Monthly Report of Disbursement page: parameters, KPIs, trend and object charts, and the month's vouchers. */
export function MrdView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const [draft, setDraft] = useState<MrdParams>(() => emptyMrdParams(fy));
  const [applied, setApplied] = useState<MrdParams>(() => emptyMrdParams(fy));
  const [errors, setErrors] = useState<Partial<Record<MrdField, string>>>({});
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetMrdReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: MrdField, value: string) => {
    setDraft((d) => changeMrdParam(d, field, value));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const announce = useRef(false);
  const generate = async () => {
    const errs = validateMrdParams(draft);
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
  const month = data?.month ?? applied.month;
  const periods = useMemo(() => splitPeriods(data?.rows ?? [], month), [data, month]);
  const rows = periods.current;
  useEffect(() => {
    if (!announce.current || isFetching) return;
    announce.current = false;
    if (error) notify("error", "Unable to generate the report", "Check the parameters and try again.");
    else if (data) notify(rows.length ? "success" : "warning", rows.length ? "Report generated" : "No disbursements", `BFARS 9, ${monthLabel(data.fiscalYear, data.month)}.`);
  }, [isFetching, data, error, notify, rows.length]);

  const filtered = useMemo(() => rows.filter((r) => matches(r, search.trim().toLowerCase())), [rows, search]);
  const { pageItems, page, pageSize, total, setPage, setPageSize } = useClientPagination(filtered, 10);
  const cur = sumByClass(rows);
  const prev = sumByClass(periods.previous);
  const objects = classSummary(cur);
  const trend = useMemo(() => monthlyTrend(data?.rows ?? []), [data]);
  const labels = mrdFilterLabels(applied, data?.options);
  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0);
  const monthText = monthLabel(fiscalYear, month);
  const prevText = month > 1 ? monthLabel(fiscalYear, month - 1) : null;
  const share = (v: number) => safeRatio(v, cur.total);

  const exportExcel = () => {
    if (!data) return;
    downloadFile(mrdFileName(data, "xlsx"), buildXlsx(buildMrdSheets(data, ALL_OPTIONS, labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", mrdFileName(data, "xlsx"));
  };
  const printReport = (asPdf: boolean) => {
    if (!data) return;
    try {
      printDocument(buildMrdDocument(data, ALL_OPTIONS, labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      if (asPdf) notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", asPdf ? "Unable to export" : "Unable to print", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const money = (v: number) => formatCurrency(v).replace("₱", "");

  return (
    <>
      <PageHeader
        title={MRD_PAGE_TITLE}
        description="View and generate the official BFARS 9 report showing monthly disbursements."
        extraCrumbs={["Monthly Report of Disbursement"]}
        actions={<Link href={MRD_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 9 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <MrdFields params={draft} onChange={onChange} options={data?.options} errors={errors} fields={["fiscalYear", "month", "department", "allotmentClass", "uacsMajor"]} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 lg:self-end xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 2xl:gap-3">
            <KpiCard icon={HandCoins} iconBg="bg-brand-600" label="Total Disbursements" value={formatCurrency(cur.total)} loading={loading}>
              <Change ratio={changeRatio(cur.total, prev.total)} against={prevText} />
            </KpiCard>
            <KpiCard icon={NotepadText} iconBg="bg-blue-600" label="No. of Transactions" value={formatNumber(cur.count)} loading={loading}>
              <Change ratio={changeRatio(cur.count, prev.count)} against={prevText} />
            </KpiCard>
            <KpiCard icon={Landmark} iconBg="bg-green-600" label="PS Disbursements" value={formatCurrency(cur.PS)} loading={loading}>
              <ShareBar label="PS" share={share(cur.PS)} color="#2563eb" />
            </KpiCard>
            <KpiCard icon={FileText} iconBg="bg-amber-400" label="MOOE Disbursements" value={formatCurrency(cur.MOOE)} loading={loading}>
              <ShareBar label="MOOE" share={share(cur.MOOE)} color="#f5b301" />
            </KpiCard>
            <KpiCard icon={Cog} iconBg="bg-purple-600" label="CO Disbursements" value={formatCurrency(cur.CO)} loading={loading}>
              <ShareBar label="CO" share={share(cur.CO)} color="#9333ea" />
            </KpiCard>
            <KpiCard icon={Grip} iconBg="bg-gray-600" label="Others/FE Disbursements" value={formatCurrency(cur.FE + cur.Others)} loading={loading}>
              <ShareBar label="Others and FE" share={share(cur.FE + cur.Others)} color="#4b5563" />
            </KpiCard>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <SectionTitle icon={ChartColumn}>Monthly Disbursements Trend (FY {fiscalYear})</SectionTitle>
              {loading ? <Skeleton className="mt-4 h-64 w-full" /> : <div className="mt-3"><MonthlyTrendChart data={trend} month={month} /></div>}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={ChartPie}>Disbursements by Object of Expenditure ({monthText})</SectionTitle>
              {loading ? (
                <Skeleton className="mt-4 h-64 w-full" />
              ) : (
                <div className="mt-3 grid items-center gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
                  <DonutChart height={250} data={objects.map((o) => ({ name: o.name, value: o.amount, color: o.color }))} centerValue={formatCompactCurrency(cur.total)} centerLabel="Total" />
                  <ul className="space-y-3.5 text-[13px]">
                    {objects.map((o) => (
                      <li key={o.code} className="grid grid-cols-[auto_minmax(0,1fr)_3rem_auto] items-center gap-x-2.5">
                        <span className="size-3 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
                        <span className="text-blue-900">{o.name}</span>
                        <span className="text-right text-gray-700 tabular-nums">{formatPercent(o.share, 1)}</span>
                        <span className="text-right font-medium text-blue-900 tabular-nums">{formatCurrency(o.amount).replace(".00", "")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
              <SectionTitle icon={FileText}>Disbursements Details</SectionTitle>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={() => printReport(true)} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => printReport(false)} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="no-print flex justify-end px-5 py-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search reference no., payee, description…" label="Search disbursements" className="w-full sm:w-80" />
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !filtered.length ? (
              <EmptyState
                title={rows.length ? "No disbursements match your search" : "No disbursements found"}
                description={rows.length ? "Try another reference number, payee or description." : `No disbursements are recorded for ${monthText} with the selected parameters. Change the filters and generate the report again.`}
              />
            ) : (
              <>
                <div className="overflow-x-auto px-5">
                  <table className="w-full min-w-[1100px] border border-gray-200 text-[13px]">
                    <caption className="sr-only">Disbursements, {monthText}</caption>
                    <thead className="bg-blue-50/70 text-gray-900">
                      <tr>
                        {HEADERS.map((h, i) => (
                          <th key={h} scope="col" className={cn("border-b border-gray-200 px-2 py-2.5 text-xs font-semibold", i === 8 ? "text-right" : i === 1 || i === 2 || i === 3 || i === 5 ? "text-left" : "text-center")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems?.map((r, i) => (
                        <tr key={r.referenceNo} className="border-t border-gray-100 hover:bg-gray-50/60">
                          <td className="px-2 py-2 text-center text-gray-600">{(page - 1) * pageSize + i + 1}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.referenceNo}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{lasaDate(r.date)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.payee}</td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">{r.uacsCode}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.objectOfExpenditure}</td>
                          <td className="px-2 py-2 text-center">{r.allotmentClass}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.description}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{money(r.amount)}</td>
                          <td className="px-2 py-2 text-center">{r.fundSource}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-100/70 font-bold text-gray-900">
                        <td colSpan={8} className="px-2 py-2.5 text-center">{search.trim() ? "TOTAL (search results)" : "TOTAL"}</td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{money(filteredTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} pageSizeOptions={[10, 25, 50]} onPageSizeChange={setPageSize} />
              </>
            )}
          </Card>
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}. Figures are disbursements dated within {monthText}; the trend covers January through December of FY {fiscalYear}.</p>}
        </>
      )}
    </>
  );
}
