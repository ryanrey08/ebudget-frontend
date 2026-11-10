"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChartColumn, Clock3, Database, FileSpreadsheet, FileText, Filter, HandCoins, NotepadText, Printer, ReceiptText, type LucideIcon } from "lucide-react";
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
import { formatCompactCurrency, formatCurrency, formatDateTime, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetSodlbiaftReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { balanceOf, buildSodlbiaftDocument, buildSodlbiaftSheets, groupByAgency, groupByProgram, sodlbiaftDate, sodlbiaftFileName, sumRows, utilizationOf, type SodlbiaftDocOptions } from "./document";
import { SodlbiaftFields, emptySodlbiaftParams, sodlbiaftFilterLabels, validateSodlbiaftParams, type SodlbiaftField } from "./SodlbiaftParamFields";
import type { SodlbiaftParams, SodlbiaftRow, SodlbiaftStatus } from "./types";

export const SODLBIAFT_GENERATE_HREF = "/bfars-reporting/bfars-5/generate";
export const SODLBIAFT_PAGE_TITLE = "BFARS 5 – Statement of Obligations, Disbursements, Liquidations and Balances from Inter-Agency Fund Transfers (SODLBIAFT)";
const STATUS_TONE: Record<SodlbiaftStatus, BadgeTone> = { "On Track": "green", Monitor: "amber", "For Liquidation": "gray" };
const PROGRAM_COLORS = ["#2f7cf6", "#ec2027", "#3cb455", "#f7a01d", "#7c3aed", "#0891b2"];
const ALL_OPTIONS: SodlbiaftDocOptions = { cover: false, summary: true, details: true, groupByAgency: true, groupByProgram: true, signature: true };
const HEADERS = ["#", "Source Agency", "Program/Project", "Implementing Office", "Date Received", "Reference No.", "Funds Received (₱)", "Obligations (₱)", "Disbursements (₱)", "Liquidations (₱)", "Balance (₱)", "% Utilization", "Status"];

const KPI_TONE = { blue: "bg-blue-600", green: "bg-green-600", red: "bg-brand-600", amber: "bg-amber-500", dark: "bg-gray-700" } as const;

/** KPI card with its share of funds received (five fit in one row, as in the BFARS 5 mockup). */
function Kpi({ label, value, ratio, icon: Icon, tone, loading }: { label: string; value: string; ratio: number; icon: LucideIcon; tone: keyof typeof KPI_TONE; loading: boolean }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full text-white", KPI_TONE[tone])}><Icon className="size-6" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-blue-900">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-12 w-full" />
        ) : (
          <>
            <p className="mt-1 text-lg font-bold tracking-tight whitespace-nowrap text-gray-900 tabular-nums" title={value}>{value}</p>
            <p className="mt-0.5 text-[13px] text-gray-600 tabular-nums">{formatPercent(ratio, 2)}</p>
            {tone === "dark" ? (
              <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-gray-500 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
              </div>
            ) : (
              <ProgressBar className="mt-2.5" value={ratio} tone={tone} label={label} />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

const matches = (r: SodlbiaftRow, q: string) => !q || [r.sourceAgency, r.project, r.program, r.office, r.referenceNo, r.status].some((v) => v.toLowerCase().includes(q));

/** BFARS 5 – SODLBIAFT page: parameters, KPI cards, charts and the BFARS 5 details table. */
export function SodlbiaftView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const [draft, setDraft] = useState<SodlbiaftParams>(() => emptySodlbiaftParams(fy));
  const [applied, setApplied] = useState<SodlbiaftParams>(() => emptySodlbiaftParams(fy));
  const [errors, setErrors] = useState<Partial<Record<SodlbiaftField, string>>>({});
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetSodlbiaftReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: SodlbiaftField, value: string) => {
    setDraft((d) => ({ ...d, [field]: field === "fiscalYear" ? Number(value) || 0 : value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const announce = useRef(false);
  const generate = async () => {
    const errs = validateSodlbiaftParams(draft);
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
    else if (data) notify(data.rows.length ? "success" : "warning", data.rows.length ? "Report generated" : "No matching records", `BFARS 5 – SODLBIAFT, ${data.period}.`);
  }, [isFetching, data, error, notify]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const filtered = useMemo(() => rows.filter((r) => matches(r, search.trim().toLowerCase())), [rows, search]);
  const { pageItems, page, pageSize, total, setPage, setPageSize } = useClientPagination(filtered, 10);
  const grand = sumRows(rows);
  const shown = sumRows(filtered);
  const agencies = data ? groupByAgency(rows, data.options.sourceAgencies) : [];
  const programs = data ? groupByProgram(rows, data.options.programs) : [];
  const labels = sodlbiaftFilterLabels(applied);
  const programColor = (p: string) => PROGRAM_COLORS[Math.max(0, data?.options.programs.indexOf(p) ?? 0) % PROGRAM_COLORS.length];

  const exportExcel = () => {
    if (!data) return;
    downloadFile(sodlbiaftFileName(data, "xlsx"), buildXlsx(buildSodlbiaftSheets(data, ALL_OPTIONS, labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", sodlbiaftFileName(data, "xlsx"));
  };
  const printReport = (asPdf: boolean) => {
    if (!data) return;
    try {
      printDocument(buildSodlbiaftDocument(data, ALL_OPTIONS, labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      if (asPdf) notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", asPdf ? "Unable to export" : "Unable to print", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const money = (v: number) => formatCurrency(v).replace("₱", "");
  const ratio = (v: number) => safeRatio(v, grand.fundsReceived);

  return (
    <>
      <PageHeader
        title={SODLBIAFT_PAGE_TITLE}
        description="View and generate the official BFARS 5 report showing transactions and balances for funds received from other government agencies."
        actions={<Link href={SODLBIAFT_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 5 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <SodlbiaftFields params={draft} onChange={onChange} options={data?.options} errors={errors} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 lg:self-end xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <Kpi label="Total Funds Received" value={formatCurrency(grand.fundsReceived)} ratio={grand.fundsReceived ? 1 : 0} icon={Database} tone="blue" loading={loading} />
            <Kpi label="Total Obligations" value={formatCurrency(grand.obligations)} ratio={ratio(grand.obligations)} icon={NotepadText} tone="green" loading={loading} />
            <Kpi label="Total Disbursements" value={formatCurrency(grand.disbursements)} ratio={ratio(grand.disbursements)} icon={HandCoins} tone="red" loading={loading} />
            <Kpi label="Total Liquidations" value={formatCurrency(grand.liquidations)} ratio={ratio(grand.liquidations)} icon={ReceiptText} tone="amber" loading={loading} />
            <Kpi label="Available Balance" value={formatCurrency(balanceOf(grand))} ratio={ratio(balanceOf(grand))} icon={Clock3} tone="dark" loading={loading} />
          </div>

          {loading ? (
            <Skeleton className="mb-5 h-80 w-full rounded-xl" />
          ) : rows.length > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader title="Fund Utilization per Source Agency" />
                <CardBody>
                  <GroupedBarChart
                    height={240}
                    data={agencies.map((g) => ({ agency: g.key, ...g.totals }))}
                    categoryKey="agency"
                    series={[
                      { key: "fundsReceived", label: "Funds Received", color: "#2f7cf6" },
                      { key: "obligations", label: "Obligations", color: "#ec2027" },
                      { key: "disbursements", label: "Disbursements", color: "#3cb455" },
                      { key: "liquidations", label: "Liquidations", color: "#f7a01d" },
                    ]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Distribution by Program/Project" />
                <CardBody className="grid items-center gap-4 sm:grid-cols-[16.5rem_minmax(0,1fr)]">
                  <DonutChart height={264} data={programs.map((g) => ({ name: g.key, value: g.totals.fundsReceived, color: programColor(g.key) }))} centerValue={formatCompactCurrency(grand.fundsReceived)} centerLabel="Total Funds Received" />
                  <ul className="space-y-3.5 text-[13px]">
                    {programs.map((g) => (
                      <li key={g.key} className="grid grid-cols-[auto_minmax(0,1fr)_3.25rem_auto] items-center gap-x-2.5">
                        <span className="size-3 rounded-full" style={{ backgroundColor: programColor(g.key) }} aria-hidden />
                        <span className="text-blue-900">{g.key}</span>
                        <span className="text-right text-gray-600 tabular-nums">{formatPercent(ratio(g.totals.fundsReceived), 1)}</span>
                        <span className="text-right font-medium tabular-nums">{formatCurrency(g.totals.fundsReceived)}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white"><ChartColumn className="size-4" aria-hidden /></span> BFARS 5 Details</h2>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={() => printReport(true)} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => printReport(false)} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="no-print flex justify-end px-5 py-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search agency, program, reference no.." label="Search BFARS 5 records" className="w-full sm:w-80" />
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !filtered.length ? (
              <EmptyState
                title={rows.length ? "No records match your search" : "No inter-agency fund transfers found"}
                description={rows.length ? "Try another agency, program or reference number." : "No transfers match the selected parameters. Change the filters and generate the report again."}
              />
            ) : (
              <>
                <div className="overflow-x-auto px-5">
                  <table className="w-full min-w-[1100px] border border-gray-200 text-[12.5px]">
                    <caption className="sr-only">Inter-agency fund transfers, {data?.period}</caption>
                    <thead className="bg-gray-50 text-gray-800">
                      <tr>
                        {HEADERS.map((h, i) => (
                          <th key={h} scope="col" className={cn("border-b border-gray-200 px-2 py-2.5 text-xs font-semibold", i >= 6 && i <= 10 ? "text-right" : i === 0 || i >= 11 ? "text-center" : "text-left")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems?.map((r, i) => (
                        <tr key={r.referenceNo} className="border-t border-gray-100 hover:bg-gray-50/60">
                          <td className="px-2 py-2 text-center text-gray-600">{(page - 1) * pageSize + i + 1}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.sourceAgency}</td>
                          <td className="px-2 py-2 whitespace-nowrap" title={r.program}>{r.project}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.office}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{sodlbiaftDate(r.dateReceived)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.referenceNo}</td>
                          {[r.fundsReceived, r.obligations, r.disbursements, r.liquidations, balanceOf(r)].map((v, k) => (
                            <td key={k} className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{money(v)}</td>
                          ))}
                          <td className="px-2 py-2 text-center tabular-nums">{formatPercent(utilizationOf(r), 2)}</td>
                          <td className="px-2 py-2 pr-3 text-center whitespace-nowrap"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-blue-100 bg-blue-50 font-semibold text-gray-900">
                        <td colSpan={6} className="px-2 py-3 text-center">TOTAL{filtered.length < rows.length ? " (search results)" : ""}</td>
                        {[shown.fundsReceived, shown.obligations, shown.disbursements, shown.liquidations, balanceOf(shown)].map((v, k) => (
                          <td key={k} className="px-2 py-3 text-right whitespace-nowrap tabular-nums">{money(v)}</td>
                        ))}
                        <td className="px-2 py-3 text-center tabular-nums">{formatPercent(utilizationOf(shown), 2)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} pageSizeOptions={[10, 25, 50]} onPageSizeChange={setPageSize} />
              </>
            )}
          </Card>
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}. Balance = funds received − obligations; % Utilization = obligations ÷ funds received, as in the BFARS 5 mockup.</p>}
        </>
      )}
    </>
  );
}
