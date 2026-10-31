"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, BarChart3, CircleCheck, ClipboardList, FileSpreadsheet, FileText, Filter, PhilippinePeso, Printer, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/utils/format";
import { useGetQproReportQuery } from "../services/bfarsApi";
import { CLASS_ORDER, buildQproDocument, buildQproSpreadsheet, downloadFile, printDocument, qproFileName } from "./document";
import { QproCharts } from "./QproCharts";
import { QproMainFields, validateQproParams, type QproField } from "./QproParamFields";
import { accomplishment, groupBy, totalsOf, utilization, type QproGroupKey } from "./summary";
import type { QproParams, QproRow, QproStatus } from "./types";

export const GENERATE_HREF = "/bfars-reporting/bfars-1/generate";
type View = "detail" | Exclude<QproGroupKey, "programType" | "pap">;
const VIEWS: { value: View; label: string }[] = [
  { value: "detail", label: "By Program/Activity/Project" },
  { value: "allotmentClass", label: "By Allotment Class" },
  { value: "department", label: "By Office/Department" },
  { value: "uacsMajor", label: "By UACS (Major)" },
];
export const STATUS_TONE: Record<QproStatus, string> = {
  "On Track": "bg-green-100 text-green-800",
  "Needs Attention": "bg-amber-100 text-amber-800",
  "At Risk": "bg-red-100 text-red-700",
};
const barTone = (u: number) => (u >= 0.7 ? "bg-green-500" : u >= 0.5 ? "bg-amber-400" : "bg-brand-500");

export const emptyParams = (fiscalYear: number): QproParams => ({ fiscalYear, quarter: "Q1", department: "", uacsMajor: "", allotmentClass: "", pap: "", fundSource: "", status: "" });

interface TableRow {
  id: string;
  code: string;
  name: string;
  cls: string;
  uacs: string;
  target: number;
  actual: number;
  allotment: number;
  obligations: number;
  disbursements: number;
  status?: QproStatus;
}

/** BFARS 1 – QPRO page: parameters, summary cards, charts and the QPRO details table. */
export function QproView() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const user = useAppSelector(selectCurrentUser);
  const [draft, setDraft] = useState<QproParams>(() => emptyParams(fy));
  const [applied, setApplied] = useState<QproParams>(() => emptyParams(fy));
  const [errors, setErrors] = useState<Partial<Record<QproField, string>>>({});
  const [view, setView] = useState<View>("detail");
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useGetQproReportQuery(applied);
  const loading = isLoading || isFetching;

  const onChange = (field: QproField, value: string) => {
    setDraft((d) => ({ ...d, [field]: field === "fiscalYear" ? Number(value) || 0 : value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const generate = async () => {
    const errs = validateQproParams(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    announce.current = true;
    if (JSON.stringify(draft) === JSON.stringify(applied)) await refetch();
    else setApplied(draft);
  };
  // Confirm once the regenerated report has arrived.
  const announce = useRef(false);
  useEffect(() => {
    if (!announce.current || isFetching) return;
    announce.current = false;
    if (error) notify("error", "Unable to generate the report", "Check the parameters and try again.");
    else if (data) notify(data.rows.length ? "success" : "warning", data.rows.length ? "Report generated" : "No matching records", `BFARS 1 – QPRO, ${data.period}: ${data.rows.length} record(s).`);
  }, [isFetching, data, error, notify]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const totals = totalsOf(rows);
  const tableRows: TableRow[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base: TableRow[] =
      view === "detail"
        ? rows.map((r: QproRow) => ({ id: r.code, code: r.code, name: r.program, cls: r.allotmentClass, uacs: r.uacsMajor, target: r.physicalTarget, actual: r.physicalActual, allotment: r.allotment, obligations: r.obligations, disbursements: r.disbursements, status: r.status }))
        : groupBy(rows, view, view === "allotmentClass" ? CLASS_ORDER : undefined).map((g) => {
            const inGroup = rows.filter((r) => r[view] === g.key);
            const uniq = (f: (r: QproRow) => string) => [...new Set(inGroup.map(f))].join(", ");
            return { id: g.key, code: g.key, name: `${g.count} program${g.count === 1 ? "" : "s"}/activit${g.count === 1 ? "y" : "ies"}`, cls: uniq((r) => r.allotmentClass), uacs: uniq((r) => r.uacsMajor), target: g.target, actual: g.actual, allotment: g.allotment, obligations: g.obligations, disbursements: g.disbursements };
          });
    return base.filter((r) => !q || [r.code, r.name, r.cls, r.uacs].some((f) => f.toLowerCase().includes(q)));
  }, [rows, view, search]);
  const paging = useClientPagination(tableRows, 10);

  const docContext = () => ({ logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, preparedBy: user ? `${user.firstName} ${user.lastName}` : "eBudget", generatedAt: formatDateTime(new Date().toISOString()) });
  const exportExcel = () => {
    if (!data) return;
    downloadFile(qproFileName(data, "xls"), buildQproSpreadsheet(data, { scope: "both", include: { cover: false, summary: true, details: true, signature: false } }), "application/vnd.ms-excel");
    notify("success", "Excel file downloaded", qproFileName(data, "xls"));
  };
  const exportPdf = () => {
    if (!data) return;
    try {
      printDocument(buildQproDocument(data, { layout: "landscape", scope: "both", include: { cover: true, summary: true, details: true, signature: true } }, docContext()).html);
      notify("info", "Save as PDF", "Choose “Save as PDF” as the destination in the print dialog.");
    } catch (err) {
      notify("error", "Unable to export", err instanceof Error ? err.message : "Printing is not available.");
    }
  };

  const prev = data?.previousCount;
  const growth = prev ? (totals.count - prev) / prev : null;
  const gap = totals.actual - totals.target;
  const pctCell = (r: TableRow) => accomplishment(r.target, r.actual);

  return (
    <>
      <PageHeader
        title="BFARS 1 – Quarterly Physical Reports of Operation (QPRO)"
        description="Shows the physical and financial accomplishments per program/activity/project for the selected quarter."
        actions={<Link href={GENERATE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="size-4" /> Report Generator</Link>}
      />

      <Card className="no-print mb-5 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); void generate(); }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end"
          aria-label="BFARS 1 report parameters"
        >
          <QproMainFields params={draft} onChange={onChange} options={data?.options} errors={errors} />
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 xl:mb-px" loading={loading} disabled={loading}>{!loading && <Filter className="size-4" />} Generate Report</Button>
        </form>
      </Card>

      {error ? (
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <Metric icon={ClipboardList} tone="bg-blue-600" label="Total Programs / Activities" value={String(totals.count)} caption={`For ${applied.quarter} ${applied.fiscalYear}`} loading={loading}
              delta={growth !== null ? { up: growth >= 0, text: formatPercent(Math.abs(growth), 0), note: `vs ${applied.quarter} ${applied.fiscalYear - 1}` } : undefined} />
            <Metric icon={PhilippinePeso} tone="bg-green-600" label="Total Physical Target" value={formatPercent(totals.target / 100, 0)} caption={`Target for ${applied.quarter} ${applied.fiscalYear}`} loading={loading} />
            <Metric icon={CircleCheck} tone="bg-brand-600" label="Total Physical Accomplishment" value={formatPercent(accomplishment(totals.target, totals.actual), 1)} caption="Overall accomplishment" loading={loading}
              delta={rows.length ? { up: gap >= 0, text: `${Math.abs(gap).toFixed(1)} pts`, note: "vs target" } : undefined} />
            <Metric icon={BarChart3} tone="bg-amber-500" label="Total Financial Utilization" value={formatPercent(utilization(totals.allotment, totals.disbursements), 1)} caption={`${formatCurrency(totals.disbursements)} disbursed of ${formatCurrency(totals.allotment)}`} loading={loading} />
          </div>

          {loading ? <Skeleton className="mb-5 h-80 w-full rounded-xl" /> : rows.length > 0 && <QproCharts rows={rows} />}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><span className="flex size-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700"><ClipboardList className="size-4" aria-hidden /></span> QPRO Details</h2>
              <div className="no-print flex flex-wrap gap-2">
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={exportExcel} disabled={!rows.length || loading}><FileSpreadsheet className="size-4" /> Export to Excel</Button>
                <Button variant="outline" className="border-red-300 text-gray-800 hover:bg-red-50" onClick={exportPdf} disabled={!rows.length || loading}><FileText className="size-4 text-brand-600" /> Export to PDF</Button>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => window.print()} disabled={!rows.length || loading}><Printer className="size-4" /> Print</Button>
              </div>
            </div>
            <div className="flex flex-col gap-3 px-5 lg:flex-row lg:items-end lg:justify-between">
              <Tabs items={VIEWS} value={view} onChange={(v) => { setView(v); paging.setPage(1); }} label="QPRO details grouping" className="border-b-0" />
              <div className="no-print w-full pb-2 lg:w-80">
                <label htmlFor="qpro-search" className="sr-only">Search program/activity/project</label>
                <Input id="qpro-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); paging.setPage(1); }} placeholder="Search program/activity/project…" leftIcon={<Search className="size-4" />} />
              </div>
            </div>

            {loading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : !tableRows.length ? (
              <EmptyState title="No QPRO records found" description={rows.length ? "No records match your search." : "No programs/activities match the selected parameters. Change the filters and generate the report again."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <caption className="sr-only">QPRO details {VIEWS.find((v) => v.value === view)?.label.toLowerCase()}</caption>
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th scope="col" rowSpan={2} className="px-3 py-2 pl-5 text-left">#</th>
                      <th scope="col" rowSpan={2} className="px-3 py-2 text-left">{view === "detail" ? "Code" : VIEWS.find((v) => v.value === view)?.label.replace("By ", "")}</th>
                      <th scope="col" rowSpan={2} className="px-3 py-2 text-left">{view === "detail" ? "Program / Activity / Project" : "Programs / Activities"}</th>
                      <th scope="col" rowSpan={2} className="px-3 py-2 text-left">Allotment Class</th>
                      <th scope="col" rowSpan={2} className="px-3 py-2 text-left">UACS (Major)</th>
                      <th scope="colgroup" colSpan={3} className="border-b border-gray-200 px-3 pt-2 pb-1 text-center">Physical</th>
                      <th scope="colgroup" colSpan={4} className="border-b border-gray-200 px-3 pt-2 pb-1 text-center">Financial (₱)</th>
                      <th scope="col" rowSpan={2} className="px-3 py-2 pr-5 text-center">Status</th>
                    </tr>
                    <tr>
                      {["Target", "Actual", "%", "Allotment", "Obligation", "Disbursement", "% Utilization"].map((h) => <th key={h} scope="col" className="px-3 pt-1 pb-2 text-right whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paging.pageItems?.map((r, i) => {
                      const u = utilization(r.allotment, r.disbursements);
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/60">
                          <td className="px-3 py-2.5 pl-5 text-gray-600">{(paging.page - 1) * paging.pageSize + i + 1}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.code}</td>
                          <td className="px-3 py-2.5">{r.name}</td>
                          <td className="px-3 py-2.5">{r.cls}</td>
                          <td className="px-3 py-2.5">{r.uacs}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{r.target.toFixed(0)}%</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{Number(r.actual.toFixed(1))}%</td>
                          <td className="px-3 py-2.5 text-right"><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums", r.status ? STATUS_TONE[r.status] : "bg-blue-50 text-blue-800")}>{formatPercent(pctCell(r), 0)}</span></td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(r.allotment)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(r.obligations)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(r.disbursements)}</td>
                          <td className="px-3 py-2.5">
                            <span className="flex min-w-36 items-center justify-end gap-2">
                              <span className="h-2 w-16 rounded-full bg-gray-100"><span className={cn("block h-full rounded-full", barTone(u))} style={{ width: `${Math.min(u * 100, 100)}%` }} /></span>
                              <span className="w-14 text-right tabular-nums">{formatPercent(u, 2)}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 pr-5 text-center">{r.status ? <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_TONE[r.status])}>{r.status}</span> : <span className="text-gray-400">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={5} className="px-3 py-2.5 pl-5">TOTAL / WEIGHTED {search && <span className="font-normal text-gray-500">(all {totals.count} records)</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{totals.target.toFixed(0)}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{totals.actual.toFixed(2)}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(accomplishment(totals.target, totals.actual), 2)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(totals.allotment)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(totals.obligations)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(totals.disbursements)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(utilization(totals.allotment, totals.disbursements), 2)}</td>
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
          {data && <p className="mt-3 text-xs text-gray-500">Sample data for {data.period}, as of {data.asOf}. Accomplishment = actual ÷ target; % utilization = disbursements ÷ allotment, as in the BFARS 1 sample workbook.</p>}
        </>
      )}
    </>
  );
}

function Metric({
  icon: Icon,
  tone,
  label,
  value,
  caption,
  delta,
  loading,
}: {
  icon: typeof ClipboardList;
  tone: string;
  label: string;
  value: string;
  caption: string;
  delta?: { up: boolean; text: string; note: string };
  loading: boolean;
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl text-white", tone)}><Icon className="size-6" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-32" />
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
              <p className="text-xs text-gray-500">{caption}</p>
            </div>
            {delta && (
              <p className="text-right text-xs text-gray-500">
                <span className={cn("flex items-center justify-end gap-0.5 text-sm font-semibold", delta.up ? "text-green-600" : "text-red-600")}>
                  {delta.up ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
                  <span className="sr-only">{delta.up ? "up" : "down"}</span>
                  {delta.text}
                </span>
                {delta.note}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
