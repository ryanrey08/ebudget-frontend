"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChartColumn, FileSpreadsheet, FileText, Filter, NotepadText, Printer, type LucideIcon } from "lucide-react";
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
import { useGetAuoReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { lasaDate } from "../lasa/document";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { AgingBarChart } from "./AuoCharts";
import { AGING_BUCKETS, auoFileName, bucketOf, bucketSummary, buildAuoDocument, buildAuoSheets, daysPastDue, objectSummary, sumAging, type AgingBucket, type AuoDocOptions } from "./document";
import { AuoFields, auoFilterLabels, changeAuoParam, emptyAuoParams, validateAuoParams, type AuoField } from "./AuoParamFields";
import type { AuoParams, AuoRow } from "./types";

export const AUO_GENERATE_HREF = "/bfars-reporting/bfars-8/generate";
export const AUO_PAGE_TITLE = "BFARS 8 – Aging of Unpaid Obligations";
const ALL_OPTIONS: AuoDocOptions = { summary: true, charts: true, signature: true };
const HEADERS = ["#", "Reference No.", "Date Obligated", "Payee / Supplier", "Object of Expenditure", "Allotment Class", "UACS Code", "Description", "Amount (₱)", "Aging (Days)", "Aging Bucket"];

/** Bracket pill and day-count colors of the dashboard mockup. */
const BUCKET_STYLE: Record<AgingBucket, { pill: string; text: string; icon: LucideIcon; iconBg: string }> = {
  current: { pill: "bg-blue-100 text-blue-800", text: "text-blue-700", icon: FileText, iconBg: "bg-blue-600" },
  d30: { pill: "bg-green-100 text-green-800", text: "text-green-700", icon: ChartColumn, iconBg: "bg-green-600" },
  d60: { pill: "bg-amber-100 text-amber-800", text: "text-amber-600", icon: FileText, iconBg: "bg-amber-400" },
  d90: { pill: "bg-red-100 text-red-700", text: "text-red-600", icon: FileText, iconBg: "bg-orange-500" },
  over90: { pill: "bg-red-200 text-red-800", text: "text-red-700", icon: FileText, iconBg: "bg-brand-600" },
};

const matches = (r: AuoRow, q: string) =>
  !q || [r.referenceNo, r.payee, r.description, r.uacsCode, r.objectOfExpenditure, r.allotmentClass].some((v) => v.toLowerCase().includes(q));

/** Bracket KPI card: amount, share of the total and a bar in the bracket's color. */
function BucketCard({ label, amount, share, color, bucket, loading }: { label: string; amount: number; share: number; color: string; bucket: AgingBucket; loading: boolean }) {
  const { icon: Icon, iconBg } = BUCKET_STYLE[bucket];
  return (
    <Card className="flex items-start gap-2.5 p-3.5">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-white", iconBg)}><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-blue-900">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-10 w-full" />
        ) : (
          <>
            <p className="mt-0.5 text-[15px] font-bold tracking-tight whitespace-nowrap text-blue-900 tabular-nums 2xl:text-sm min-[1700px]:text-[15px]" title={formatCurrency(amount)}>{formatCurrency(amount)}</p>
            <p className="mt-1 text-[13px] text-gray-600 tabular-nums">{formatPercent(share, 2)}</p>
            <div role="progressbar" aria-label={`${label} share`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: color }} />
            </div>
          </>
        )}
      </div>
    </Card>
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

/** BFARS 8 – Aging of Unpaid Obligations page: parameters, bracket KPIs, charts and the details table. */
export function AuoView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const [draft, setDraft] = useState<AuoParams>(() => emptyAuoParams(fy));
  const [applied, setApplied] = useState<AuoParams>(() => emptyAuoParams(fy));
  const [errors, setErrors] = useState<Partial<Record<AuoField, string>>>({});
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetAuoReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: AuoField, value: string) => {
    setDraft((d) => changeAuoParam(d, field, value));
    setErrors((e) => ({ ...e, [field]: undefined, ...(field === "fiscalYear" ? { asOf: undefined } : {}) }));
  };
  const announce = useRef(false);
  const generate = async () => {
    const errs = validateAuoParams(draft);
    setErrors(errs);
    if (Object.keys(errs).length) {
      notify("error", "Unable to generate the report", "Complete the required parameters.");
      return;
    }
    announce.current = true;
    if (JSON.stringify(draft) === JSON.stringify(applied)) await refetch();
    else setApplied(draft);
  };
  useEffect(() => {
    if (!announce.current || isFetching) return;
    announce.current = false;
    if (error) notify("error", "Unable to generate the report", "Check the parameters and try again.");
    else if (data) notify(data.rows.length ? "success" : "warning", data.rows.length ? "Report generated" : "No unpaid obligations", `BFARS 8, ${data.period}.`);
  }, [isFetching, data, error, notify]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const asOf = data?.asOf ?? applied.asOf;
  const filtered = useMemo(() => rows.filter((r) => matches(r, search.trim().toLowerCase())), [rows, search]);
  const { pageItems, page, pageSize, total, setPage, setPageSize } = useClientPagination(filtered, 10);
  const totals = sumAging(rows, asOf);
  const buckets = bucketSummary(totals);
  const objects = objectSummary(rows);
  const labels = auoFilterLabels(applied, data?.options);
  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0);

  const exportExcel = () => {
    if (!data) return;
    downloadFile(auoFileName(data, "xlsx"), buildXlsx(buildAuoSheets(data, ALL_OPTIONS, labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", auoFileName(data, "xlsx"));
  };
  const printReport = (asPdf: boolean) => {
    if (!data) return;
    try {
      printDocument(buildAuoDocument(data, ALL_OPTIONS, labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      if (asPdf) notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", asPdf ? "Unable to export" : "Unable to print", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const money = (v: number) => formatCurrency(v).replace("₱", "");

  return (
    <>
      <PageHeader
        title={AUO_PAGE_TITLE}
        description="View and generate the official BFARS 8 report showing the aging of unpaid obligations."
        extraCrumbs={["Aging of Unpaid Obligations"]}
        actions={<Link href={AUO_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 8 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <AuoFields params={draft} onChange={onChange} options={data?.options} errors={errors} fields={["fiscalYear", "asOf", "department", "allotmentClass", "uacsMajor"]} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 lg:self-end xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,1.3fr)_repeat(5,minmax(0,1fr))] 2xl:gap-3">
            <Card className="flex items-center gap-3 p-3.5 sm:col-span-2 lg:col-span-1">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><NotepadText className="size-7" aria-hidden /></span>
              <div className="min-w-0">
                <p className="text-sm text-blue-900">Total Unpaid Obligations</p>
                {loading ? <Skeleton className="mt-2 h-8 w-44" /> : <p className="text-xl font-bold tracking-tight whitespace-nowrap text-blue-900 tabular-nums 2xl:text-lg">{formatCurrency(totals.total)}</p>}
                <p className="mt-1 text-sm text-gray-600">As of {lasaDate(asOf)}</p>
              </div>
            </Card>
            {buckets.map((b) => <BucketCard key={b.key} bucket={b.key} label={b.label} amount={b.amount} share={b.share} color={b.color} loading={loading} />)}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <SectionTitle icon={ChartColumn}>Unpaid Obligations by Aging Bucket</SectionTitle>
              {loading ? <Skeleton className="mt-4 h-64 w-full" /> : <div className="mt-3"><AgingBarChart data={buckets} /></div>}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={ChartColumn}>Unpaid Obligations by Object of Expenditure</SectionTitle>
              {loading ? (
                <Skeleton className="mt-4 h-64 w-full" />
              ) : (
                <div className="mt-3 grid items-center gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
                  <DonutChart height={240} data={objects.map((o) => ({ name: o.name, value: o.amount, color: o.color }))} centerValue={formatCompactCurrency(totals.total)} centerLabel="Total Unpaid" />
                  <ul className="space-y-3.5 text-sm">
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
              <SectionTitle icon={FileText}>Unpaid Obligations Details</SectionTitle>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={() => printReport(true)} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => printReport(false)} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="no-print flex justify-end px-5 py-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search reference no., payee, description…" label="Search unpaid obligations" className="w-full sm:w-80" />
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !filtered.length ? (
              <EmptyState
                title={rows.length ? "No obligations match your search" : "No unpaid obligations found"}
                description={rows.length ? "Try another reference number, payee or description." : "No unpaid obligations match the selected parameters. Change the filters and generate the report again."}
              />
            ) : (
              <>
                <div className="overflow-x-auto px-5">
                  <table className="w-full min-w-[1080px] border border-gray-200 text-[13px]">
                    <caption className="sr-only">Unpaid obligations, {data?.period}</caption>
                    <thead className="bg-blue-50/70 text-gray-900">
                      <tr>
                        {HEADERS.map((h, i) => (
                          <th key={h} scope="col" className={cn("border-b border-gray-200 px-2 py-2.5 text-xs font-semibold", i === 8 ? "text-right" : "text-center")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems?.map((r, i) => {
                        const b = bucketOf(r, asOf);
                        return (
                          <tr key={r.referenceNo} className="border-t border-gray-100 hover:bg-gray-50/60">
                            <td className="px-2 py-2 text-center text-gray-600">{(page - 1) * pageSize + i + 1}</td>
                            <td className="px-2 py-2 text-center whitespace-nowrap">{r.referenceNo}</td>
                            <td className="px-2 py-2 text-center whitespace-nowrap">{lasaDate(r.dateObligated)}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{r.payee}</td>
                            <td className="px-2 py-2 text-center">{r.objectOfExpenditure}</td>
                            <td className="px-2 py-2 text-center">{r.allotmentClass}</td>
                            <td className="px-2 py-2 text-center whitespace-nowrap">{r.uacsCode}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{r.description}</td>
                            <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{money(r.amount)}</td>
                            <td className={cn("px-2 py-2 text-center font-medium tabular-nums", BUCKET_STYLE[b].text)} title={`Due ${lasaDate(r.dueDate)}`}>{daysPastDue(r, asOf)}</td>
                            <td className="px-2 py-2 pr-3 text-center"><span className={cn("inline-block min-w-24 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap", BUCKET_STYLE[b].pill)}>{AGING_BUCKETS.find((x) => x.key === b)!.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-100/70 font-bold text-gray-900">
                        <td colSpan={8} className="px-2 py-2.5 text-center">{search.trim() ? "TOTAL (search results)" : "TOTAL"}</td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(filteredTotal)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} pageSizeOptions={[10, 25, 50]} onPageSizeChange={setPageSize} />
              </>
            )}
          </Card>
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}. Aging is counted in days past each obligation&apos;s due date; obligations not yet due are Current.</p>}
        </>
      )}
    </>
  );
}
