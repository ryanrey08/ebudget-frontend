"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChartColumnBig, ChartPie, Database, FileSpreadsheet, FileText, Filter, Landmark, Layers, Printer, type LucideIcon } from "lucide-react";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils/cn";
import { buildXlsx } from "@/lib/utils/xlsx";
import { formatCompactCurrency, formatCurrency, formatDateTime, formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetSabudbtrReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { MonthlyUtilizationChart } from "./SabudbtrCharts";
import { buildSabudbtrDocument, buildSabudbtrSheets, byFund, fundShares, monthlyTotals, quarterLabel, sabudbtrFileName, sumRows } from "./document";
import { SabudbtrFields, changeSabudbtrParam, emptySabudbtrParams, sabudbtrFilterLabels, validateSabudbtrParams, type SabudbtrField } from "./SabudbtrParamFields";
import { DEFAULT_SABUDBTR_OPTIONS, paramsApplied, selectSabudbtr } from "./sabudbtrSlice";
import type { Quarter } from "../qpro/types";
import type { SabudbtrParams, SabudbtrRow } from "./types";

export const SABUDBTR_GENERATE_HREF = "/bfars-reporting/bfars-11/generate";
export const SABUDBTR_PAGE_TITLE = "BFARS 11 – Statement of Approved Budget, Utilizations, Disbursements and Balances for Trust Receipts (SABUDBTR)";
const HEADERS = ["#", "Fund / Trust Receipt", "UACS Code", "UACS Description", "Approved Budget (₱)", "Utilizations (₱)", "Disbursements (₱)", "Unutilized Balance (₱)", "Cash Balance (₱)", "% Utilized"];

const matches = (r: SabudbtrRow, q: string) => !q || [r.fund, r.activity, r.office, r.uacsCode, r.uacsDescription].some((v) => v.toLowerCase().includes(q));

/** BFARS 11 parameters applied on the dashboard (shared with the generator through Redux). */
export function useSabudbtrParams(): SabudbtrParams {
  const fy = useFiscalYear();
  return useAppSelector(selectSabudbtr).params ?? emptySabudbtrParams(fy);
}

function KpiCard({ icon: Icon, iconBg, label, value, loading, children }: { icon: LucideIcon; iconBg: string; label: string; value: string; loading: boolean; children?: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full text-white 2xl:size-14", iconBg)}><Icon className="size-6 2xl:size-7" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-tight text-blue-900">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-10 w-full" />
        ) : (
          <>
            <p className="mt-1 text-[17px] font-bold tracking-tight whitespace-nowrap text-blue-900 tabular-nums" title={value}>{value}</p>
            {children}
          </>
        )}
      </div>
    </Card>
  );
}

/** "% of approved budget" with a bar, under each KPI except the approved budget. */
function ShareBar({ label, share, color }: { label: string; share: number; color: string }) {
  return (
    <>
      <p className="mt-0.5 text-[13px] text-gray-700 tabular-nums">{formatPercent(share, 2)}</p>
      <div role="progressbar" aria-label={`${label} as a share of the approved budget`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(share, 0), 1) * 100}%`, backgroundColor: color }} />
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

/** BFARS 11 – SABUDBTR page: parameters, KPIs, monthly and fund charts, and the statement by trust receipt fund. */
export function SabudbtrView() {
  const notify = useNotify();
  const dispatch = useAppDispatch();
  const applied = useSabudbtrParams();
  const [draft, setDraft] = useState<SabudbtrParams>(applied);
  const [errors, setErrors] = useState<Partial<Record<SabudbtrField, string>>>({});
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetSabudbtrReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: SabudbtrField, value: string) => {
    setDraft((d) => changeSabudbtrParam(d, field, value, data?.options));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const announce = useRef(false);
  const generate = async () => {
    const errs = validateSabudbtrParams(draft);
    setErrors(errs);
    if (Object.keys(errs).length) {
      notify("error", "Unable to generate the report", "Complete the required parameters.");
      return;
    }
    announce.current = true;
    if (JSON.stringify(draft) === JSON.stringify(applied)) await refetch();
    else dispatch(paramsApplied(draft));
  };

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const fiscalYear = data?.fiscalYear ?? applied.fiscalYear;
  const quarter: Quarter = data?.quarter ?? (applied.quarter || "Q1");
  useEffect(() => {
    if (!announce.current || isFetching) return;
    announce.current = false;
    if (error) notify("error", "Unable to generate the report", "Check the parameters and try again.");
    else if (data) notify(rows.length ? "success" : "warning", rows.length ? "Report generated" : "No trust receipts", `BFARS 11, ${quarterLabel(data.fiscalYear, data.quarter)}.`);
  }, [isFetching, data, error, notify, rows.length]);

  const filteredRows = useMemo(() => rows.filter((r) => matches(r, search.trim().toLowerCase())), [rows, search]);
  const lines = useMemo(() => byFund(filteredRows), [filteredRows]);
  const { pageItems, page, pageSize, total, setPage, setPageSize } = useClientPagination(lines, 10);
  const t = sumRows(rows);
  const shown = sumRows(filteredRows);
  const shares = fundShares(rows);
  const trend = useMemo(() => monthlyTotals(rows, quarter), [rows, quarter]);
  const labels = sabudbtrFilterLabels(applied, data?.options);
  const qText = quarterLabel(fiscalYear, quarter);

  const exportExcel = () => {
    if (!data) return;
    downloadFile(sabudbtrFileName(data, "xlsx"), buildXlsx(buildSabudbtrSheets(data, DEFAULT_SABUDBTR_OPTIONS, "fund", labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", sabudbtrFileName(data, "xlsx"));
  };
  const printReport = (asPdf: boolean) => {
    if (!data) return;
    try {
      printDocument(buildSabudbtrDocument(data, DEFAULT_SABUDBTR_OPTIONS, "fund", labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      if (asPdf) notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", asPdf ? "Unable to export" : "Unable to print", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const money = (v: number) => formatCurrency(v).replace("₱", "");
  const kpis: { label: string; value: number; icon: LucideIcon; bg: string; color: string }[] = [
    { label: "Total Utilizations", value: t.utilizations, icon: Layers, bg: "bg-green-600", color: "#16a34a" },
    { label: "Total Disbursements", value: t.disbursements, icon: FileText, bg: "bg-amber-400", color: "#f59e0b" },
    { label: "Unutilized Balance", value: t.unutilized, icon: ChartPie, bg: "bg-purple-600", color: "#9333ea" },
    { label: "Cash Balance", value: t.cashBalance, icon: Database, bg: "bg-red-600", color: "#dc2626" },
  ];

  return (
    <>
      <PageHeader
        title={SABUDBTR_PAGE_TITLE}
        description="View and generate the official BFARS 11 report for Trust Receipts."
        extraCrumbs={["SABUDBTR"]}
        actions={<Link href={SABUDBTR_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 11 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <SabudbtrFields params={draft} onChange={onChange} options={data?.options} errors={errors} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 lg:self-end xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <KpiCard icon={Landmark} iconBg="bg-blue-600" label="Total Approved Budget" value={formatCurrency(t.approvedBudget)} loading={loading} />
            {kpis.map((k) => (
              <KpiCard key={k.label} icon={k.icon} iconBg={k.bg} label={k.label} value={formatCurrency(k.value)} loading={loading}>
                <ShareBar label={k.label} share={safeRatio(k.value, t.approvedBudget)} color={k.color} />
              </KpiCard>
            ))}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <SectionTitle icon={ChartColumnBig}>Monthly Utilization vs. Disbursements (FY {fiscalYear})</SectionTitle>
              {loading ? <Skeleton className="mt-4 h-64 w-full" /> : <div className="mt-3"><MonthlyUtilizationChart data={trend} /></div>}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={ChartColumnBig}>Trust Receipts by Fund/Activity (Utilizations)</SectionTitle>
              {loading ? (
                <Skeleton className="mt-4 h-64 w-full" />
              ) : !shares.length ? (
                <EmptyState title="No utilizations" description="No trust receipts match the selected parameters." />
              ) : (
                <div className="mt-3 grid items-center gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
                  <DonutChart height={250} data={shares.map((s) => ({ name: s.fund, value: s.amount, color: s.color }))} centerValue={formatCompactCurrency(t.utilizations)} centerLabel="Total Utilizations" />
                  <ul className="space-y-4 text-[13px]">
                    {shares.map((s) => (
                      <li key={s.fund} className="grid grid-cols-[auto_minmax(0,1fr)_3rem_auto] items-center gap-x-2.5">
                        <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                        <span className="leading-snug text-blue-900">Trust Receipts - {s.fund}</span>
                        <span className="text-right text-gray-700 tabular-nums">{formatPercent(s.share, 1)}</span>
                        <span className="text-right font-medium whitespace-nowrap text-blue-900 tabular-nums">₱ {formatNumber(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
              <SectionTitle icon={ChartColumnBig}>Trust Receipt Details</SectionTitle>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={() => printReport(true)} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => printReport(false)} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="no-print flex justify-end px-5 py-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search fund, activity, UACS, description…" label="Search trust receipts" className="w-full sm:w-80" />
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !lines.length ? (
              <EmptyState
                title={rows.length ? "No trust receipts match your search" : "No trust receipts found"}
                description={rows.length ? "Try another fund, activity, UACS code or description." : `No trust receipts are recorded for the ${qText} with the selected parameters. Change the filters and generate the report again.`}
              />
            ) : (
              <>
                <div className="overflow-x-auto px-5">
                  <table className="w-full min-w-[1100px] border border-gray-200 text-[13px]">
                    <caption className="sr-only">Trust receipts by fund, {qText}</caption>
                    <thead className="bg-blue-50/70 text-gray-900">
                      <tr>
                        {HEADERS.map((h, i) => (
                          <th key={h} scope="col" className={cn("border-b border-l border-gray-200 px-2 py-2.5 text-xs font-semibold first:border-l-0", i >= 4 ? "text-center" : i === 0 || i === 2 ? "text-center" : "text-left")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems?.map((l, i) => (
                        <tr key={l.fund} className="border-t border-gray-100 hover:bg-gray-50/60">
                          <td className="px-2 py-2 text-center text-gray-600">{(page - 1) * pageSize + i + 1}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{l.fund}</td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">{l.uacsCode}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{l.uacsDescription}</td>
                          {[l.approvedBudget, l.utilizations, l.disbursements, l.unutilized, l.cashBalance].map((v, k) => (
                            <td key={k} className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{money(v)}</td>
                          ))}
                          <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{formatPercent(l.rate, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-100/70 font-bold text-gray-900">
                        <td colSpan={4} className="px-2 py-2.5 text-center">{search.trim() ? "TOTAL (search results)" : "TOTAL"}</td>
                        {[shown.approvedBudget, shown.utilizations, shown.disbursements, shown.unutilized, shown.cashBalance].map((v, k) => (
                          <td key={k} className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{money(v)}</td>
                        ))}
                        <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{formatPercent(shown.rate, 2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} pageSizeOptions={[10, 25, 50]} onPageSizeChange={setPageSize} />
              </>
            )}
          </Card>
          {data && (
            <p className="mt-3 text-xs text-gray-500">
              Sample data for {data.period}, as of the quarter end (year-to-date). Unutilized balance = approved budget − utilizations; cash balance = utilizations − disbursements (the sample workbook&apos;s undisbursed utilizations, not a verified bank balance). UACS codes are placeholders.
            </p>
          )}
        </>
      )}
    </>
  );
}
