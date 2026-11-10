"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChartColumn, ChartPie, Database, FileSpreadsheet, FileText, Filter, HandCoins, ListChecks, NotepadText, Printer, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart } from "@/components/charts/DonutChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatCard } from "@/components/shared/StatCard";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { cn } from "@/lib/utils/cn";
import { buildXlsx } from "@/lib/utils/xlsx";
import { formatCompactCurrency, formatCurrency, formatDateTime, formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetSabudbReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { SaaodbFields, emptySaaodbParams, filterLabels, validateSaaodbParams, type SaaodbField } from "../saaodb/SaaodbParamFields";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { approvedBudget, balanceOf, buildSabudbDocument, buildSabudbSheets, groupByClass, sabudbFileName, sumRows, utilizationRate, utilizations, type SabudbDocOptions, type SabudbTotals } from "./document";
import type { SabudbParams } from "./types";

export const SABUDB_GENERATE_HREF = "/bfars-reporting/bfars-6/generate";
export const SABUDB_FIELD_ORDER: SaaodbField[] = ["fiscalYear", "quarter", "department", "allotmentClass", "uacsMajor"];
export const SABUDB_PAGE_TITLE = "BFARS 6 – Statement of Approved Budget, Utilizations, Disbursements and Balances (SABUDB)";

const SERIES = [
  { key: "approved", label: "Approved Budget", color: "#2f7cf6" },
  { key: "utilizations", label: "Utilizations", color: "#3cb455" },
  { key: "disbursements", label: "Disbursements", color: "#ec2027" },
  { key: "balance", label: "Balance", color: "#f7a01d" },
];

/** BFARS 6 – SABUDB page: parameters, KPI cards, charts and the per-UACS-major table. */
export function SabudbView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const [draft, setDraft] = useState<SabudbParams>(() => emptySaaodbParams(fy));
  const [applied, setApplied] = useState<SabudbParams>(() => emptySaaodbParams(fy));
  const [errors, setErrors] = useState<Partial<Record<SaaodbField, string>>>({});
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetSabudbReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: SaaodbField, value: string) => {
    setDraft((d) => ({ ...d, [field]: field === "fiscalYear" ? Number(value) || 0 : value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const announce = useRef(false);
  const generate = async () => {
    const errs = validateSaaodbParams(draft);
    setErrors(errs);
    if (Object.keys(errs).length) {
      notify("error", "Missing report parameters", "Select the fiscal year and quarter.");
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
    else if (data) notify(data.rows.length ? "success" : "warning", data.rows.length ? "Report generated" : "No matching records", `BFARS 6 – SABUDB, ${data.period}.`);
  }, [isFetching, data, error, notify]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const groups = useMemo(() => groupByClass(rows), [rows]);
  const grand = sumRows(rows);
  const approved = approvedBudget(grand);
  const labels = filterLabels(applied, data?.options);
  const allOpts: SabudbDocOptions = { view: "detailed", cover: false, signature: true, groupByClass: true, groupByObject: true, previousYear: false, notes: true };

  const tableGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    // Match the UACS major, its name, or any object code / object of expenditure under it.
    return groups.filter((g) => [g.major, g.name, g.code, ...g.rows.flatMap((r) => [r.uacsCode, r.objectOfExpenditure])].some((t) => t.toLowerCase().includes(q)));
  }, [groups, search]);
  const paging = useClientPagination(tableGroups, 10);

  const exportExcel = () => {
    if (!data) return;
    downloadFile(sabudbFileName(data, "xlsx"), buildXlsx(buildSabudbSheets(data, allOpts, labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", sabudbFileName(data, "xlsx"));
  };
  const exportPdf = () => {
    if (!data) return;
    try {
      printDocument(buildSabudbDocument(data, allOpts, labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", "Unable to export", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const cells = (t: SabudbTotals, strong = false) => {
    return (
      <>
        {[approvedBudget(t), t.allotments, t.obligations, t.disbursements, utilizations(t), balanceOf(t)].map((v, i) => (
          <td key={i} className={cn("px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums", strong && "font-semibold")}>{formatCurrency(v).replace("₱", "")}</td>
        ))}
        <td className={cn("px-2.5 py-2.5 pr-5 text-right tabular-nums", strong && "font-semibold")}>{formatPercent(utilizationRate(t), 2)}</td>
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={SABUDB_PAGE_TITLE}
        description="View and generate the official BFARS 6 report showing approved budgets and actual utilizations, disbursements and balances."
        actions={<Link href={SABUDB_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 6 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <SaaodbFields params={draft} onChange={onChange} options={data?.options} errors={errors} order={SABUDB_FIELD_ORDER} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          {/* Five across on wide screens; 3 + 2 full-width rows below that so amounts never wrap. */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6 xl:*:col-span-2 xl:[&>*:nth-child(n+4)]:col-span-3 min-[1700px]:grid-cols-5 min-[1700px]:*:col-span-1 min-[1700px]:[&>*:nth-child(n+4)]:col-span-1">
            <StatCard label="Total Approved Budget" value={formatCurrency(approved)} caption={formatPercent(approved ? 1 : 0, 2)} icon={Database} iconTone="blue" progress={{ value: approved ? 1 : 0, tone: "blue" }} loading={loading} />
            <StatCard label="Total Utilizations" value={formatCurrency(utilizations(grand))} caption={formatPercent(safeRatio(utilizations(grand), approved), 2)} icon={ChartColumn} iconTone="green" progress={{ value: safeRatio(utilizations(grand), approved), tone: "green" }} loading={loading} />
            <StatCard label="Total Disbursements" value={formatCurrency(grand.disbursements)} caption={formatPercent(safeRatio(grand.disbursements, approved), 2)} icon={HandCoins} iconTone="red" progress={{ value: safeRatio(grand.disbursements, approved), tone: "red" }} loading={loading} />
            <StatCard label="Total Obligations" value={formatCurrency(grand.obligations)} caption={formatPercent(safeRatio(grand.obligations, approved), 2)} icon={NotepadText} iconTone="amber" progress={{ value: safeRatio(grand.obligations, approved), tone: "amber" }} loading={loading} />
            <StatCard label="Available Balance" value={formatCurrency(balanceOf(grand))} caption={formatPercent(safeRatio(balanceOf(grand), approved), 2)} icon={ChartPie} iconTone="dark" progress={{ value: safeRatio(balanceOf(grand), approved), tone: "blue" }} loading={loading} />
          </div>

          {loading ? (
            <Skeleton className="mb-5 h-80 w-full rounded-xl" />
          ) : rows.length > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Budget Utilization by Expense Class" />
                <CardBody>
                  <GroupedBarChart
                    height={260}
                    data={groups.map((g) => ({ cls: g.shortName, approved: approvedBudget(g.totals), utilizations: utilizations(g.totals), disbursements: g.totals.disbursements, balance: balanceOf(g.totals) }))}
                    categoryKey="cls"
                    wrapTicks
                    series={SERIES}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Budget Allocation by UACS (Major)" />
                <CardBody className="grid items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <DonutChart height={200} data={groups.map((g) => ({ name: `${g.code} (${g.major})`, value: approvedBudget(g.totals), color: g.color }))} centerValue={formatCompactCurrency(approved)} centerLabel="Approved Budget" />
                  <ul className="space-y-3 text-sm">
                    {groups.map((g) => (
                      <li key={g.code} className="grid grid-cols-[auto_minmax(0,1fr)_3rem_auto] items-center gap-x-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                        <span className="text-blue-900">{g.code} ({g.major}) – {g.name}</span>
                        <span className="text-right text-gray-600 tabular-nums">{formatPercent(safeRatio(approvedBudget(g.totals), approved), 1)}</span>
                        <span className="text-right font-medium tabular-nums">₱{formatNumber(Math.round(approvedBudget(g.totals)))}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white"><ListChecks className="size-4" aria-hidden /></span> BFARS 6 Details</h2>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={exportPdf} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => window.print()} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="no-print flex justify-end px-5 pb-3">
              <div className="w-full sm:w-96">
                <label htmlFor="sabudb-search" className="sr-only">Search UACS, object of expenditure, description</label>
                <Input id="sabudb-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); paging.setPage(1); }} placeholder="Search UACS, object of expenditure, description…" leftIcon={<Search className="size-4" />} />
              </div>
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : !tableGroups.length ? (
              <EmptyState title="No BFARS 6 records found" description={rows.length ? "No UACS or object of expenditure matches your search." : "No approved budget matches the selected parameters. Change the filters and generate the report again."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm">
                  <caption className="sr-only">SABUDB per UACS major, {data?.period}</caption>
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      {["#", "UACS Code", "Object of Expenditure", "Approved Budget (₱)", "Allotments (₱)", "Obligations (₱)", "Disbursements (₱)", "Utilizations (₱)", "Balance (₱)", "% Utilization"].map((h, i) => (
                        <th key={h} scope="col" className={cn("px-2.5 py-2.5 text-xs first:pl-5 last:pr-5", i >= 3 ? "text-right" : i === 2 ? "text-left" : "text-center")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paging.pageItems?.map((g, i) => (
                      <tr key={g.code} className="border-t border-gray-100">
                        <td className="px-2.5 py-2.5 pl-5 text-center">{(paging.page - 1) * paging.pageSize + i + 1}</td>
                        <td className="px-2.5 py-2.5 text-center">{g.major}</td>
                        <td className="min-w-48 px-2.5 py-2.5">{g.name}</td>
                        {cells(g.totals)}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-blue-200 bg-blue-50 text-blue-900">
                      <td className="pl-5" />
                      <td colSpan={2} className="px-3 py-3 text-center font-bold">TOTAL {search && <span className="font-normal text-gray-500">(all records)</span>}</td>
                      {cells(grand, true)}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {!loading && paging.total > 0 && (
              <div className="no-print border-t border-gray-100">
                <Pagination page={paging.page} pageSize={paging.pageSize} total={paging.total} onPageChange={paging.setPage} pageSizeOptions={[10, 25, 50]} onPageSizeChange={paging.setPageSize} />
              </div>
            )}
          </Card>
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}. Utilizations equal obligations; balance = approved budget − utilizations; % utilization = utilizations ÷ approved budget, as in the BFARS 6 sample workbook.</p>}
        </>
      )}
    </>
  );
}
