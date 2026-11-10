"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, Database, FileSpreadsheet, FileText, FileX2, Filter, ListChecks, Printer, WalletCards, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart } from "@/components/charts/DonutChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { SearchInput } from "@/components/shared/SearchInput";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { cn } from "@/lib/utils/cn";
import { buildXlsx } from "@/lib/utils/xlsx";
import { formatCompactCurrency, formatCurrency, formatDateTime, formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetLasaReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { balanceOf, buildLasaDocument, lasaDate, buildLasaSheets, groupByClass, lasaFileName, monthlyTotals, sumRows, topAllottees, type LasaDocOptions } from "./document";
import { LasaFields, emptyLasaParams, lasaFilterLabels, validateLasaParams, type LasaField } from "./LasaParamFields";
import type { LasaParams, LasaRow, LasaStatus } from "./types";

export const LASA_GENERATE_HREF = "/bfars-reporting/bfars-4/generate";
export const LASA_PAGE_TITLE = "BFARS 4 – List of Allotments and Sub-Allotments (LASA)";
export const STATUS_TONE: Record<LasaStatus, BadgeTone> = { Released: "green", Partial: "amber", "On Hold": "red", Cancelled: "gray" };
const CLASS_COLORS: Record<string, string> = { RAOPS: "#2f7cf6", RAOMO: "#ec2027", RAOCO: "#3cb455", RAOFE: "#f7a01d" };
const ALL_OPTIONS: LasaDocOptions = { cover: false, summary: true, groupByClass: false, subAllotments: true, status: true, signature: true };
const HEADERS = ["#", "Allotment No.", "Date", "Allotment Class", "UACS (Major)", "Object of Expenditure", "Allottee (Office)", "Allotment Amount (₱)", "Sub-Allotment Amount (₱)", "Released Amount (₱)", "Balance (₱)", "Status"];

const KPI_TONE = { blue: "bg-blue-600", green: "bg-green-600", red: "bg-brand-600", amber: "bg-amber-500", dark: "bg-gray-800" } as const;

/** Compact KPI card (five fit in one row, as in the BFARS 4 mockup). */
function Kpi({ label, value, ratio, of, caption, icon: Icon, tone, loading }: { label: string; value: string; ratio?: number; of?: string; caption?: string; icon: LucideIcon; tone: keyof typeof KPI_TONE; loading: boolean }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full text-white", KPI_TONE[tone])}><Icon className="size-6" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-12 w-full" />
        ) : (
          <>
            <p className="mt-1 text-lg font-bold tracking-tight whitespace-nowrap text-gray-900 tabular-nums" title={value}>{value}</p>
            <p className="mt-0.5 text-[13px] text-gray-500">{ratio !== undefined ? `${formatPercent(ratio, 2)} of ${of}` : caption}</p>
            {ratio !== undefined && tone !== "dark" && <ProgressBar className="mt-2.5" value={ratio} tone={tone} label={label} />}
          </>
        )}
      </div>
    </Card>
  );
}

const matches = (r: LasaRow, q: string) =>
  !q || [r.allotmentNo, r.purpose, r.allottee, r.objectOfExpenditure, r.allotmentClass, r.uacsMajor, r.status].some((v) => v.toLowerCase().includes(q));

/** BFARS 4 – LASA page: parameters, KPI cards, the LASA details table and charts. */
export function LasaView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const [draft, setDraft] = useState<LasaParams>(() => emptyLasaParams(fy));
  const [applied, setApplied] = useState<LasaParams>(() => emptyLasaParams(fy));
  const [errors, setErrors] = useState<Partial<Record<LasaField, string>>>({});
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetLasaReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: LasaField, value: string) => {
    setDraft((d) => ({ ...d, [field]: field === "fiscalYear" ? Number(value) || 0 : value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const announce = useRef(false);
  const generate = async () => {
    const errs = validateLasaParams(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    announce.current = true;
    if (JSON.stringify(draft) === JSON.stringify(applied)) await refetch();
    else setApplied(draft);
  };
  useEffect(() => {
    if (!announce.current || isFetching) return;
    announce.current = false;
    if (error) notify("error", "Unable to generate the report", "Check the parameters and try again.");
    else if (data) notify(data.rows.length ? "success" : "warning", data.rows.length ? "Report generated" : "No matching records", `BFARS 4 – LASA, ${data.period}.`);
  }, [isFetching, data, error, notify]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const filtered = useMemo(() => rows.filter((r) => matches(r, search.trim().toLowerCase())), [rows, search]);
  const { pageItems, page, pageSize, total, setPage, setPageSize } = useClientPagination(filtered, 10);
  const grand = sumRows(rows);
  const balance = balanceOf(grand);
  const groups = groupByClass(rows);
  const monthly = data ? monthlyTotals(rows, data.fiscalYear, data.quarter) : [];
  const top = topAllottees(rows);
  const labels = lasaFilterLabels(applied, data?.options);

  const exportExcel = () => {
    if (!data) return;
    downloadFile(lasaFileName(data, "xlsx"), buildXlsx(buildLasaSheets(data, ALL_OPTIONS, labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", lasaFileName(data, "xlsx"));
  };
  const printReport = (asPdf: boolean) => {
    if (!data) return;
    try {
      printDocument(buildLasaDocument(data, ALL_OPTIONS, labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      if (asPdf) notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", asPdf ? "Unable to export" : "Unable to print", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const money = (v: number) => formatCurrency(v).replace("₱", "");

  return (
    <>
      <PageHeader
        title={LASA_PAGE_TITLE}
        description="View and generate the official LASA report showing all allotments and sub-allotments for the selected parameters."
        actions={<Link href={LASA_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 4 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
          <LasaFields params={draft} onChange={onChange} options={data?.options} errors={errors} fields={["fiscalYear", "department", "allotmentClass", "quarter"]} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 sm:col-span-2 lg:col-span-1 lg:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,0.8fr)]">
            <Kpi label="Total Allotments" value={formatCurrency(grand.allotmentAmount)} ratio={safeRatio(grand.allotmentAmount, data?.appropriations ?? 0)} of="Appropriations" icon={Database} tone="blue" loading={loading} />
            <Kpi label="Total Sub-Allotments" value={formatCurrency(grand.subAllotmentAmount)} ratio={safeRatio(grand.subAllotmentAmount, grand.allotmentAmount)} of="Allotments" icon={FileText} tone="green" loading={loading} />
            <Kpi label="Released Amount" value={formatCurrency(grand.releasedAmount)} ratio={safeRatio(grand.releasedAmount, grand.allotmentAmount)} of="Allotments" icon={FileX2} tone="red" loading={loading} />
            <Kpi label="Remaining Balance" value={formatCurrency(balance)} ratio={safeRatio(balance, grand.allotmentAmount)} of="Allotments" icon={WalletCards} tone="amber" loading={loading} />
            <Kpi label="Total Records" value={formatNumber(grand.count)} caption="Allotments and Sub-Allotments" icon={Clock3} tone="dark" loading={loading} />
          </div>

          <Card className="mb-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white"><ListChecks className="size-4" aria-hidden /></span> LASA Details</h2>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={() => printReport(true)} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => printReport(false)} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="no-print flex justify-end px-5 py-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search allotment, reference no., purpose…" label="Search LASA records" className="w-full sm:w-80" />
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !filtered.length ? (
              <EmptyState
                title={rows.length ? "No records match your search" : "No LASA records found"}
                description={rows.length ? "Try another allotment number, office or purpose." : "No allotments match the selected parameters. Change the filters and generate the report again."}
              />
            ) : (
              <>
                <div className="overflow-x-auto px-5">
                  <table className="w-full min-w-[1040px] border border-gray-200 text-[13px]">
                    <caption className="sr-only">List of allotments and sub-allotments, {data?.period}</caption>
                    <thead className="bg-gray-50 text-gray-800">
                      <tr>
                        {HEADERS.map((h, i) => (
                          <th key={h} scope="col" className={cn("border-b border-gray-200 px-2 py-2.5 text-xs font-semibold", i >= 7 && i <= 10 ? "text-right" : i === 0 || (i >= 3 && i <= 4) || i === 11 ? "text-center" : "text-left")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems?.map((r, i) => (
                        <tr key={r.allotmentNo} className="border-t border-gray-100 hover:bg-gray-50/60">
                          <td className="px-2 py-2 text-center text-gray-600">{(page - 1) * pageSize + i + 1}</td>
                          <td className="px-2 py-2 whitespace-nowrap" title={r.purpose}>{r.allotmentNo}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{lasaDate(r.date)}</td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">{r.allotmentClass}</td>
                          <td className="px-2 py-2 text-center">{r.uacsMajor}</td>
                          <td className="px-2 py-2">{r.objectOfExpenditure}</td>
                          <td className="px-2 py-2">{r.allottee}</td>
                          {[r.allotmentAmount, r.subAllotmentAmount, r.releasedAmount, balanceOf(r)].map((v, k) => (
                            <td key={k} className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{money(v)}</td>
                          ))}
                          <td className="px-2 py-2 pr-3 text-center"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} pageSizeOptions={[10, 25, 50]} onPageSizeChange={setPageSize} />
              </>
            )}
          </Card>

          {loading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : rows.length > 0 && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Allotments by Allotment Class" />
                <CardBody className="grid items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <DonutChart height={210} data={groups.map((g) => ({ name: g.key, value: g.totals.allotmentAmount, color: CLASS_COLORS[g.key] }))} centerValue={formatCompactCurrency(grand.allotmentAmount)} centerLabel="Total Allotments" />
                  <ul className="space-y-3 text-[13px]">
                    {groups.map((g) => (
                      <li key={g.key} className="grid grid-cols-[auto_3.25rem_3rem_minmax(0,1fr)] items-center gap-x-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: CLASS_COLORS[g.key] }} aria-hidden />
                        <span className="text-blue-900">{g.key}</span>
                        <span className="text-gray-600 tabular-nums">{formatPercent(safeRatio(g.totals.allotmentAmount, grand.allotmentAmount), 1)}</span>
                        <span className="text-right font-medium tabular-nums">{formatCurrency(g.totals.allotmentAmount)}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Monthly Allotments and Sub-Allotments" />
                <CardBody>
                  <GroupedBarChart
                    height={220}
                    data={monthly}
                    categoryKey="month"
                    series={[
                      { key: "allotments", label: "Allotments", color: "#2f7cf6" },
                      { key: "subAllotments", label: "Sub-Allotments", color: "#3cb455" },
                    ]}
                  />
                </CardBody>
              </Card>
              <Card className="lg:col-span-2 2xl:col-span-1">
                <CardHeader title="Top Allottee Offices" />
                <CardBody>
                  <ul className="space-y-3.5 text-sm">
                    {top.map((t) => (
                      <li key={t.office} className="grid grid-cols-[minmax(0,8.5rem)_minmax(2rem,1fr)_auto] items-center gap-2.5">
                        <span className="truncate text-gray-800" title={t.office}>{t.office}</span>
                        <span className="h-5 rounded-sm bg-gray-100"><span className="block h-full rounded-sm bg-blue-500" style={{ width: `${safeRatio(t.amount, top[0].amount) * 100}%` }} /></span>
                        <span className="text-right font-medium tabular-nums">{formatCompactCurrency(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          )}
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}. Balance = allotment − released amount, as in the BFARS 4 sample workbook.</p>}
        </>
      )}
    </>
  );
}
