"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Download, FileText, Filter, Maximize2, Minus, Plus, Printer, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useNotify } from "@/hooks/useNotify";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { buildSpreadsheetXml, buildXlsx } from "@/lib/utils/xlsx";
import { useGetSabudbtrReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { buildSabudbtrDocument, buildSabudbtrSheets, quarterLabel, sabudbtrFileName } from "./document";
import { SabudbtrFields, changeSabudbtrParam, sabudbtrFilterLabels, validateSabudbtrParams, type SabudbtrField } from "./SabudbtrParamFields";
import { formatChanged, groupByChanged, optionToggled, paramsApplied, selectSabudbtr, type SabudbtrDocOptions, type SabudbtrFormat, type SabudbtrGroupBy } from "./sabudbtrSlice";
import { SABUDBTR_PAGE_TITLE, useSabudbtrParams } from "./SabudbtrView";
import type { SabudbtrParams } from "./types";
import { useRecordGeneration } from "../hooks/useRecordGeneration";
import { getErrorMessage } from "@/lib/api/error-handler";

const OPTIONS: { key: keyof SabudbtrDocOptions; label: string }[] = [
  { key: "summary", label: "Include Summary Page" },
  { key: "details", label: "Include Detailed Transactions" },
  { key: "previousQuarter", label: "Show Comparative (Previous Quarter)" },
  { key: "percentUtilized", label: "Include Percentage of Utilization" },
  { key: "signatories", label: "Include Signatories Page" },
];
const GROUPS: { value: SabudbtrGroupBy; label: string }[] = [
  { value: "fund", label: "Trust Receipt Fund" },
  { value: "activity", label: "Fund / Activity" },
];
const FORMATS: { value: SabudbtrFormat; label: string }[] = [
  { value: "pdf", label: "PDF (Recommended)" },
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "xls", label: "Excel (XLS)" },
];

const docContext = () => ({ logoUrl: `${typeof window === "undefined" ? "" : window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) });

function PanelTitle({ icon: Icon, children }: { icon: typeof Filter; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 rounded-lg bg-blue-50/70 py-1.5 pr-3 text-lg font-semibold text-blue-800">
      <span className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white"><Icon className="size-5" aria-hidden /></span>
      {children}
    </h2>
  );
}

/** Generate BFARS 11 (SABUDBTR): parameters and options on the left, a live paged preview on the right. */
export function SabudbtrGenerator() {
  const notify = useNotify();
  const recordGeneration = useRecordGeneration("bfars-11");
  const dispatch = useAppDispatch();
  const { groupBy, options: opts, format } = useAppSelector(selectSabudbtr);
  const initialParams = useSabudbtrParams();
  const [params, setParams] = useState<SabudbtrParams>(initialParams);
  const [errors, setErrors] = useState<Partial<Record<SabudbtrField, string>>>({});
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(0.6);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const valid = !Object.keys(validateSabudbtrParams(params)).length;
  const { data, isFetching, error, refetch } = useGetSabudbtrReportQuery(params, { skip: !valid });
  const nothingSelected = !opts.summary && !opts.details && !opts.previousQuarter;

  const doc = useMemo(
    () => (data && valid ? buildSabudbtrDocument(data, opts, groupBy, sabudbtrFilterLabels(params, data.options), docContext()) : null),
    [data, valid, opts, groupBy, params],
  );
  const pageCount = doc?.pageCount ?? 0;

  const onChange = (field: SabudbtrField, value: string) => {
    const next = changeSabudbtrParam(params, field, value, data?.options);
    setParams(next);
    setErrors((e) => ({ ...e, [field]: undefined }));
    setPage(1);
    // Valid parameters are shared with the dashboard, so going back keeps them.
    if (!Object.keys(validateSabudbtrParams(next)).length) dispatch(paramsApplied(next));
  };

  const goToPage = (n: number) => {
    if (!pageCount) return;
    const target = Math.min(Math.max(n, 1), pageCount);
    setPage(target);
    frameRef.current?.contentDocument?.getElementById(`page-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const generate = async () => {
    const errs = validateSabudbtrParams(params);
    setErrors(errs);
    if (Object.keys(errs).length) {
      notify("error", "Unable to generate the report", "Complete the required parameters.");
      return;
    }
    if (nothingSelected) {
      notify("error", "Nothing to include", "Select the summary page, the detailed transactions or the comparative statement.");
      return;
    }
    setBusy(true);
    try {
      const report = await refetch().unwrap();
      const labels = sabudbtrFilterLabels(params, report.options);
      if (!report.rows.length) notify("warning", "No trust receipts", `No trust receipts are recorded for the ${quarterLabel(report.fiscalYear, report.quarter)} with the selected parameters.`);
      if (format === "pdf") {
        printDocument(buildSabudbtrDocument(report, opts, groupBy, labels, docContext()).html);
        notify("success", "Report generated", "Choose “Save as PDF” in the print dialog to save the PDF.");
      } else {
        const sheets = buildSabudbtrSheets(report, opts, groupBy, labels);
        if (format === "xlsx") downloadFile(sabudbtrFileName(report, "xlsx"), buildXlsx(sheets), XLSX_MIME);
        else downloadFile(sabudbtrFileName(report, "xls"), buildSpreadsheetXml(sheets), "application/vnd.ms-excel");
        notify("success", "Report generated", `${sabudbtrFileName(report, format)} was downloaded.`);
      }
      recordGeneration(params, format);
    } catch (err) {
      notify("error", "Unable to generate the report", getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const tool = "rounded p-1.5 text-white hover:bg-white/10 disabled:opacity-40";

  return (
    <>
      <PageHeader
        title={SABUDBTR_PAGE_TITLE}
        description="Generate and preview the official BFARS 11 report for Trust Receipts."
        extraCrumbs={["Generate Report"]}
        actions={<Link href="/bfars-reporting/bfars-11" className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><ArrowLeft className="size-4" /> Back to Dashboard</Link>}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <Card className="space-y-5 self-start p-5">
          <PanelTitle icon={Filter}>Report Parameters</PanelTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <SabudbtrFields params={params} onChange={onChange} options={data?.options} errors={errors} />
          </div>
          <fieldset className="space-y-2.5">
            <legend className="mb-2 text-sm font-semibold text-blue-800">Group by</legend>
            {GROUPS.map((g) => (
              <label key={g.value} className="flex items-center gap-2.5 text-sm text-blue-800">
                <input type="radio" name="group-by" value={g.value} checked={groupBy === g.value} onChange={() => { dispatch(groupByChanged(g.value)); setPage(1); }} className="size-[18px] accent-blue-600" />
                {g.label}
              </label>
            ))}
          </fieldset>
          <PanelTitle icon={Settings}>Display Options</PanelTitle>
          <fieldset className="space-y-2.5">
            <legend className="sr-only">Display options</legend>
            {OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-2.5 text-sm text-blue-800">
                <input type="checkbox" className="size-[18px] accent-blue-600" checked={opts[o.key]} onChange={(e) => { dispatch(optionToggled({ key: o.key, value: e.target.checked })); setPage(1); }} />
                {o.label}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2.5 border-t border-gray-100 pt-4">
            <legend className="mb-2 text-lg font-semibold text-blue-800">Output Format</legend>
            {FORMATS.map((f) => (
              <label key={f.value} className="flex items-center gap-2.5 text-sm text-blue-800">
                <input type="radio" name="format" value={f.value} checked={format === f.value} onChange={() => dispatch(formatChanged(f.value))} className="size-[18px] accent-blue-600" />
                {f.label}
              </label>
            ))}
          </fieldset>
          {nothingSelected && <p className="text-xs text-red-600">Select the summary page, the detailed transactions or the comparative statement.</p>}
          <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700" onClick={generate} loading={busy} disabled={busy}>{!busy && <FileText className="size-4" />} Generate Report</Button>
        </Card>

        <div ref={shellRef} className="flex min-h-[720px] flex-col overflow-hidden rounded-xl bg-gray-800 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-white">
            <FileText className="size-5" aria-hidden />
            <button type="button" className={tool} onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ArrowLeft className="size-4" /></button>
            <button type="button" className={tool} onClick={() => goToPage(page + 1)} disabled={page >= pageCount} aria-label="Next page"><ArrowRight className="size-4" /></button>
            <label htmlFor="sabudbtr-page" className="sr-only">Page</label>
            <input id="sabudbtr-page" type="number" min={1} max={pageCount || 1} value={page} onChange={(e) => goToPage(Number(e.target.value))} className="h-8 w-12 rounded bg-gray-700 text-center" />
            <span>/ {pageCount || "–"}</span>
            <span className="mx-1 h-5 w-px bg-gray-600" aria-hidden />
            <button type="button" className={tool} onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))} aria-label="Zoom out"><Minus className="size-4" /></button>
            <span className="w-12 rounded bg-gray-700 py-1 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button type="button" className={tool} onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))} aria-label="Zoom in"><Plus className="size-4" /></button>
            <span className="ml-auto flex gap-1">
              <button type="button" className={tool} onClick={generate} disabled={busy || !doc} aria-label={`Download as ${format.toUpperCase()}`} title={`Download (${format.toUpperCase()})`}><Download className="size-4" /></button>
              <button type="button" className={tool} onClick={() => doc && printDocument(doc.html)} disabled={!doc} aria-label="Print" title="Print"><Printer className="size-4" /></button>
              <button type="button" className={tool} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : shellRef.current?.requestFullscreen())} aria-label="Full screen" title="Full screen"><Maximize2 className="size-4" /></button>
            </span>
          </div>
          <div className={cn("relative flex flex-1 bg-gray-300", isFetching && "opacity-70")}>
            {error ? (
              <div className="m-auto rounded-lg bg-white p-4"><ErrorState error={error} onRetry={refetch} /></div>
            ) : !valid ? (
              <p className="m-auto rounded-lg bg-white px-4 py-3 text-sm text-gray-700">Select the fiscal year and quarter to preview the report.</p>
            ) : !doc ? (
              <Skeleton className="m-6 h-[620px] flex-1 rounded" />
            ) : (
              <iframe
                ref={frameRef}
                title="BFARS 11 report preview"
                srcDoc={doc.html.replace("</style>", `body{zoom:${zoom}}</style>`)}
                className="min-h-[660px] w-full flex-1"
                onLoad={() => {
                  const win = frameRef.current?.contentWindow;
                  win?.addEventListener("scroll", () => {
                    const d = frameRef.current?.contentDocument;
                    if (!d) return;
                    let current = 1;
                    for (let i = 1; i <= pageCount; i++) if ((d.getElementById(`page-${i}`)?.offsetTop ?? Infinity) * zoom <= d.documentElement.scrollTop + 40) current = i;
                    setPage(current);
                  });
                  goToPage(page);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
