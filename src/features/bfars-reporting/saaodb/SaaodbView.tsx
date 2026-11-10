"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, Database, FileCheck2, FileSpreadsheet, FileText, Filter, Printer, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart } from "@/components/charts/DonutChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatCard } from "@/components/shared/StatCard";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { cn } from "@/lib/utils/cn";
import { buildXlsx } from "@/lib/utils/xlsx";
import { formatCompactCurrency, formatCurrency, formatDateTime, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetSaaodbReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { buildSaaodbDocument, buildSaaodbSheets, classTitle, groupByClass, saaodbFileName, sumRows, unobligated, utilizationRate, type SaaodbTotals } from "./document";
import { SaaodbFields, emptySaaodbParams, filterLabels, validateSaaodbParams, type SaaodbField } from "./SaaodbParamFields";
import type { SaaodbParams } from "./types";

export const SAAODB_GENERATE_HREF = "/bfars-reporting/bfars-2/generate";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CLASS_COLORS: Record<string, string> = { RAOPS: "#2f7cf6", RAOMO: "#ec2027", RAOCO: "#3cb455", RAOFE: "#f7a01d" };
const REMARK_TONE: Record<string, string> = { "On Track": "bg-green-50 text-green-700", Monitor: "bg-amber-50 text-amber-700" };
const barTone = (u: number) => (u >= 0.65 ? "bg-blue-500" : u >= 0.45 ? "bg-amber-400" : "bg-brand-500");

/** BFARS 2 – SAAODB page: parameters, KPI cards, the SAAODB table and charts. */
export function SaaodbView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const [draft, setDraft] = useState<SaaodbParams>(() => emptySaaodbParams(fy));
  const [applied, setApplied] = useState<SaaodbParams>(() => emptySaaodbParams(fy));
  const [errors, setErrors] = useState<Partial<Record<SaaodbField, string>>>({});
  const { data, isLoading, isFetching, error, refetch } = useGetSaaodbReportQuery(applied);
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
    else if (data) notify(data.rows.length ? "success" : "warning", data.rows.length ? "Report generated" : "No matching records", `BFARS 2 – SAAODB, ${data.period}.`);
  }, [isFetching, data, error, notify]);

  const rows = data?.rows ?? [];
  const groups = groupByClass(rows);
  const grand = sumRows(rows);
  const labels = filterLabels(applied, data?.options);
  const allOpts = { cover: false, summary: true, detailed: true, perUacs: true, signature: true };

  const exportExcel = () => {
    if (!data) return;
    downloadFile(saaodbFileName(data, "xlsx"), buildXlsx(buildSaaodbSheets(data, allOpts, labels)), XLSX_MIME);
    notify("success", "Excel file downloaded", saaodbFileName(data, "xlsx"));
  };
  const exportPdf = () => {
    if (!data) return;
    try {
      printDocument(buildSaaodbDocument(data, { ...allOpts, perUacs: false }, labels, { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
      notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", "Unable to export", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const cells = (t: SaaodbTotals, strong = false) => {
    const u = utilizationRate(t);
    return (
      <>
        {[t.appropriations, t.allotments, t.obligations, t.disbursements, unobligated(t)].map((v, i) => (
          <td key={i} className={cn("px-2.5 py-2 text-right whitespace-nowrap tabular-nums", strong && "font-semibold")}>{formatCurrency(v).replace("₱", "")}</td>
        ))}
        <td className="px-3 py-2">
          <span className="flex min-w-28 items-center gap-2">
            <span className={cn("w-14 text-right tabular-nums", strong && "font-semibold")}>{formatPercent(u, 2)}</span>
            <span className="h-2 w-12 rounded-full bg-gray-100"><span className={cn("block h-full rounded-full", barTone(u))} style={{ width: `${Math.min(u * 100, 100)}%` }} /></span>
          </span>
        </td>
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="BFARS 2 – Statement of Appropriation, Allotments, Obligations, Disbursements and Balances (SAAODB)"
        description="Shows the detailed status of appropriations, allotments, obligations, disbursements and balances per allotment class and object of expenditure."
        actions={<Link href={SAAODB_GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} aria-label="BFARS 2 report parameters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          <SaaodbFields params={draft} onChange={onChange} options={data?.options} errors={errors} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <StatCard label="Total Appropriations" value={formatCurrency(grand.appropriations)} caption={`FY ${applied.fiscalYear} GAA`} icon={Database} iconTone="blue" loading={loading} />
            <StatCard label="Total Allotments" value={formatCurrency(grand.allotments)} caption={`${formatPercent(safeRatio(grand.allotments, grand.appropriations), 2)} of Appropriations`} icon={FileText} iconTone="green" progress={{ value: safeRatio(grand.allotments, grand.appropriations), tone: "blue" }} loading={loading} />
            <StatCard label="Total Obligations" value={formatCurrency(grand.obligations)} caption={`${formatPercent(safeRatio(grand.obligations, grand.allotments), 2)} of Allotments`} icon={FileCheck2} iconTone="red" progress={{ value: safeRatio(grand.obligations, grand.allotments), tone: "green" }} loading={loading} />
            <StatCard label="Total Disbursements" value={formatCurrency(grand.disbursements)} caption={`${formatPercent(safeRatio(grand.disbursements, grand.allotments), 2)} of Allotments`} icon={Wallet} iconTone="amber" progress={{ value: safeRatio(grand.disbursements, grand.allotments), tone: "amber" }} loading={loading} />
            <StatCard label="Unobligated Balance" value={formatCurrency(unobligated(grand))} caption={`${formatPercent(safeRatio(unobligated(grand), grand.allotments), 2)} of Allotments`} icon={Clock3} iconTone="dark" progress={{ value: safeRatio(unobligated(grand), grand.allotments), tone: "red" }} loading={loading} />
          </div>

          <Card className="mb-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white"><FileText className="size-4" aria-hidden /></span> SAAODB Report</h2>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={exportPdf} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => window.print()} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !rows.length ? (
              <EmptyState title="No SAAODB records found" description="No appropriations match the selected parameters. Change the filters and generate the report again." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm">
                  <caption className="sr-only">SAAODB per allotment class and object of expenditure, {data?.period}</caption>
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      {["#", "Allotment Class", "Object of Expenditure (UACS)", "Appropriations (₱)", "Allotments (₱)", "Obligations (₱)", "Disbursements (₱)", "Unobligated Balance (₱)", "% Utilization", "Remarks"].map((h, i) => (
                        <th key={h} scope="col" className={cn("px-2.5 py-2.5 text-xs first:pl-5 last:pr-5", i >= 3 && i <= 7 ? "text-right" : i === 9 ? "text-center" : "text-left")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, gi) => (
                      <Fragment key={g.code}>
                        <tr className="border-t border-gray-200 bg-white">
                          <td className="px-3 py-2 pl-5 font-semibold">{gi + 1}</td>
                          <td colSpan={9} className="px-3 py-2 font-semibold text-gray-900">{classTitle(g.code)}</td>
                        </tr>
                        {g.rows.map((r, ri) => (
                          <tr key={`${r.uacsMajor}-${ri}`} className="border-t border-gray-100">
                            <td className="pl-5" />
                            <td className="px-3 py-2 text-gray-600">{gi + 1}.{ri + 1}</td>
                            <td className="px-3 py-2">{r.uacsMajor} – {r.objectOfExpenditure}</td>
                            {cells(r)}
                            <td className="px-3 py-2 pr-5 text-center"><span className={cn("rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", REMARK_TONE[r.remarks] ?? "bg-gray-100 text-gray-700")}>{r.remarks}</span></td>
                          </tr>
                        ))}
                        <tr className="border-t border-blue-100 bg-blue-50/70">
                          <td className="pl-5" />
                          <td colSpan={2} className="px-3 py-2 text-center font-semibold">Total {g.code}</td>
                          {cells(g.totals, true)}
                          <td />
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-blue-200 bg-blue-50 text-blue-900">
                      <td className="pl-5" />
                      <td colSpan={2} className="px-3 py-2.5 text-center font-bold">GRAND TOTAL</td>
                      {cells(grand, true)}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {loading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : rows.length > 0 && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Appropriations, Allotments, Obligations and Disbursements by Allotment Class" />
                <CardBody>
                  <GroupedBarChart
                    height={240}
                    data={groups.map((g) => ({ cls: g.code, ...g.totals }))}
                    categoryKey="cls"
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
                <CardHeader title="Distribution of Obligations by Allotment Class" />
                <CardBody className="grid items-center gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
                  <DonutChart height={220} data={groups.map((g) => ({ name: g.code, value: g.totals.obligations, color: CLASS_COLORS[g.code] }))} centerValue={formatCompactCurrency(grand.obligations)} centerLabel="Total Obligations" />
                  <ul className="space-y-3 text-sm">
                    {groups.map((g) => (
                      <li key={g.code} className="grid grid-cols-[auto_4rem_3.5rem_minmax(0,1fr)] items-center gap-x-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: CLASS_COLORS[g.code] }} aria-hidden />
                        <span className="text-blue-900">{g.code}</span>
                        <span className="text-gray-600 tabular-nums">{formatPercent(safeRatio(g.totals.obligations, grand.obligations), 1)}</span>
                        <span className="text-right font-medium tabular-nums">{formatCurrency(g.totals.obligations)}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          )}
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}. Unobligated balance = allotments − obligations; % utilization = disbursements ÷ allotments, as in the BFARS 2 sample workbook.</p>}
        </>
      )}
    </>
  );
}
