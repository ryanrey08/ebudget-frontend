"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, Database, FileCheck2, FileSpreadsheet, FileText, Filter, ListChecks, Printer, Search, Wallet } from "lucide-react";
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
import { useGetSaaodboeReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { SaaodbFields, emptySaaodbParams, filterLabels, validateSaaodbParams, type SaaodbField } from "../saaodb/SaaodbParamFields";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { buildSaaodboeDocument, buildSaaodboeSheets, groupByObjectClass, saaodboeFileName, sumRows, unobligated, utilizationRate, type ObjectClassGroup, type SaaodboeTotals } from "./document";
import type { SaaodboeParams } from "./types";

export const SAAODBOE_GENERATE_HREF = "/bfars-reporting/bfars-3/generate";
export const SAAODBOE_FIELD_ORDER: SaaodbField[] = ["fiscalYear", "quarter", "department", "uacsMajor", "allotmentClass"];
const REMARK_TONE: Record<string, string> = {
  "On Track": "bg-green-50 text-green-700",
  Monitor: "bg-amber-50 text-amber-700",
  "Needs Attention": "bg-red-50 text-red-700",
  "For Allotment": "bg-blue-50 text-blue-700",
};
/** Labels as in the mockup: "Personnel Services (PS)" on the chart, "MOOE" in the legend, "Others" on both. */
const chartLabel = (g: Pick<ObjectClassGroup, "code" | "name">) => (g.code === "Others" ? g.code : `${g.name} (${g.code})`);
const legendLabel = (g: Pick<ObjectClassGroup, "code" | "name">) => (g.code === "MOOE" ? g.code : chartLabel(g));
const barTone = (u: number) => (u >= 0.8 ? "bg-green-500" : u >= 0.6 ? "bg-amber-400" : u > 0 ? "bg-brand-500" : "bg-transparent");

/** BFARS 3 – SAAODBOE page: parameters, KPI cards, charts and the per-object-class table. */
export function SaaodboeView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const [draft, setDraft] = useState<SaaodboeParams>(() => emptySaaodbParams(fy));
  const [applied, setApplied] = useState<SaaodboeParams>(() => emptySaaodbParams(fy));
  const [errors, setErrors] = useState<Partial<Record<SaaodbField, string>>>({});
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetSaaodboeReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: SaaodbField, value: string) => {
    setDraft((d) => ({ ...d, [field]: field === "fiscalYear" ? Number(value) || 0 : value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const announce = useRef(false);
  const generate = async () => {
    const errs = validateSaaodbParams(draft);
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
    else if (data) notify(data.rows.length ? "success" : "warning", data.rows.length ? "Report generated" : "No matching records", `BFARS 3 – SAAODBOE, ${data.period}.`);
  }, [isFetching, data, error, notify]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const groups = useMemo(() => groupByObjectClass(rows), [rows]);
  const grand = sumRows(rows);
  const labels = filterLabels(applied, data?.options);
  const allOpts = { cover: false, summary: true, detailed: true, totalPerMajor: true, signature: true };

  const tableGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    // Match the object class, its UACS major, or any object of expenditure under it.
    return groups.filter((g) => [g.label, g.name, ...g.rows.flatMap((r) => [r.uacsCode, r.objectOfExpenditure])].some((t) => t.toLowerCase().includes(q)));
  }, [groups, search]);
  const paging = useClientPagination(tableGroups, 10);

  const exportExcel = () => {
    if (!data) return;
    downloadFile(saaodboeFileName(data, "xlsx"), buildXlsx(buildSaaodboeSheets(data, allOpts, labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", saaodboeFileName(data, "xlsx"));
  };
  const exportPdf = () => {
    if (!data) return;
    try {
      printDocument(buildSaaodboeDocument(data, allOpts, labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", "Unable to export", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const cells = (t: SaaodboeTotals, strong = false) => {
    const u = utilizationRate(t);
    return (
      <>
        {[t.appropriations, t.allotments, t.obligations, t.disbursements, unobligated(t)].map((v, i) => (
          <td key={i} className={cn("px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums", strong && "font-semibold")}>{formatCurrency(v).replace("₱", "")}</td>
        ))}
        <td className="px-3 py-2.5">
          <span className="flex min-w-36 items-center gap-2">
            <span className="h-2.5 w-20 rounded-full bg-gray-100"><span className={cn("block h-full rounded-full", strong ? "bg-blue-600" : barTone(u))} style={{ width: `${Math.min(u * 100, 100)}%` }} /></span>
            <span className={cn("w-14 text-right tabular-nums", strong && "font-semibold")}>{formatPercent(u, 2)}</span>
          </span>
        </td>
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="BFARS 3 – Summary of Appropriations, Allotments, Obligations, Disbursements and Balances by Object of Expenditures (SAAODBOE)"
        description="Shows the detailed status per Object of Expenditures (MOOE, PS, CO, etc.) for the selected parameters."
        actions={<Link href={SAAODBOE_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 3 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <SaaodbFields params={draft} onChange={onChange} options={data?.options} errors={errors} order={SAAODBOE_FIELD_ORDER} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          {/* Five across on wide screens; 3 + 2 full-width rows below that so amounts never wrap. */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6 xl:*:col-span-2 xl:[&>*:nth-child(n+4)]:col-span-3 min-[1700px]:grid-cols-5 min-[1700px]:*:col-span-1 min-[1700px]:[&>*:nth-child(n+4)]:col-span-1">
            <StatCard label="Total Appropriations" value={formatCurrency(grand.appropriations)} caption={`FY ${applied.fiscalYear} GAA`} icon={Database} iconTone="blue" loading={loading} />
            <StatCard label="Total Allotments" value={formatCurrency(grand.allotments)} caption={`${formatPercent(safeRatio(grand.allotments, grand.appropriations), 2)} of Appropriations`} icon={FileText} iconTone="green" progress={{ value: safeRatio(grand.allotments, grand.appropriations), tone: "blue" }} loading={loading} />
            <StatCard label="Total Obligations" value={formatCurrency(grand.obligations)} caption={`${formatPercent(safeRatio(grand.obligations, grand.allotments), 2)} of Allotments`} icon={FileCheck2} iconTone="red" progress={{ value: safeRatio(grand.obligations, grand.allotments), tone: "green" }} loading={loading} />
            <StatCard label="Total Disbursements" value={formatCurrency(grand.disbursements)} caption={`${formatPercent(safeRatio(grand.disbursements, grand.allotments), 2)} of Allotments`} icon={Wallet} iconTone="amber" progress={{ value: safeRatio(grand.disbursements, grand.allotments), tone: "amber" }} loading={loading} />
            <StatCard label="Unobligated Balance" value={formatCurrency(unobligated(grand))} caption={`${formatPercent(safeRatio(unobligated(grand), grand.allotments), 2)} of Allotments`} icon={Clock3} iconTone="dark" progress={{ value: safeRatio(unobligated(grand), grand.allotments), tone: "red" }} loading={loading} />
          </div>

          {loading ? (
            <Skeleton className="mb-5 h-80 w-full rounded-xl" />
          ) : rows.length > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Appropriations, Allotments, Obligations and Disbursements by Object of Expenditures" />
                <CardBody>
                  <GroupedBarChart
                    height={260}
                    data={groups.map((g) => ({ cls: chartLabel(g), ...g.totals }))}
                    categoryKey="cls"
                    wrapTicks
                    series={[
                      { key: "appropriations", label: "Appropriations", color: "#2f7cf6" },
                      { key: "allotments", label: "Allotments", color: "#3cb455" },
                      { key: "obligations", label: "Obligations", color: "#ec2027" },
                      { key: "disbursements", label: "Disbursements", color: "#f7a01d" },
                    ]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Distribution of Obligations by Object of Expenditures" />
                <CardBody className="grid items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <DonutChart height={200} data={groups.map((g) => ({ name: g.code, value: g.totals.obligations, color: g.color }))} centerValue={formatCompactCurrency(grand.obligations)} centerLabel="Total Obligations" />
                  <ul className="space-y-3 text-sm">
                    {groups.map((g) => (
                      <li key={g.code} className="grid grid-cols-[auto_minmax(0,1fr)_3rem_auto] items-center gap-x-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                        <span className="text-blue-900">{legendLabel(g)}</span>
                        <span className="text-right text-gray-600 tabular-nums">{formatPercent(safeRatio(g.totals.obligations, grand.obligations), 1)}</span>
                        <span className="text-right font-medium tabular-nums">₱{formatNumber(Math.round(g.totals.obligations))}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white"><ListChecks className="size-4" aria-hidden /></span> SAAODBOE Details</h2>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={exportPdf} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => window.print()} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="no-print flex justify-end px-5 pb-3">
              <div className="w-full sm:w-80">
                <label htmlFor="saaodboe-search" className="sr-only">Search object of expenditure</label>
                <Input id="saaodboe-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); paging.setPage(1); }} placeholder="Search object of expenditure…" leftIcon={<Search className="size-4" />} />
              </div>
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : !tableGroups.length ? (
              <EmptyState title="No SAAODBOE records found" description={rows.length ? "No object of expenditure matches your search." : "No appropriations match the selected parameters. Change the filters and generate the report again."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1240px] text-sm">
                  <caption className="sr-only">SAAODBOE per object of expenditures, {data?.period}</caption>
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      {["#", "Object of Expenditures (UACS Code)", "Description", "Appropriations (₱)", "Allotments (₱)", "Obligations (₱)", "Disbursements (₱)", "Unobligated Balance (₱)", "% Utilization", "Remarks"].map((h, i) => (
                        <th key={h} scope="col" className={cn("px-2.5 py-2.5 text-xs first:pl-5 last:pr-5", i >= 3 && i <= 7 ? "text-right" : i === 9 ? "text-center" : "text-left")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paging.pageItems?.map((g, i) => (
                      <tr key={g.code} className="border-t border-gray-100">
                        <td className="px-2.5 py-2.5 pl-5">{(paging.page - 1) * paging.pageSize + i + 1}</td>
                        <td className="px-2.5 py-2.5 whitespace-nowrap">{g.label}</td>
                        <td className="min-w-48 px-2.5 py-2.5">{g.name}</td>
                        {cells(g.totals)}
                        <td className="px-3 py-2.5 pr-5 text-center">{data?.remarks[g.code] && <span className={cn("rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap", REMARK_TONE[data.remarks[g.code]!] ?? "bg-gray-100 text-gray-700")}>{data.remarks[g.code]}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-blue-200 bg-blue-50 text-blue-900">
                      <td className="pl-5" />
                      <td colSpan={2} className="px-3 py-3 text-center font-bold">TOTAL {search && <span className="font-normal text-gray-500">(all records)</span>}</td>
                      {cells(grand, true)}
                      <td />
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
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}. Unobligated balance = allotments − obligations; % utilization = obligations ÷ allotments, as in the BFARS 3 sample workbook.</p>}
        </>
      )}
    </>
  );
}
