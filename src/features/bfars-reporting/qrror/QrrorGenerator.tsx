"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, FileText, Filter, Maximize2, Minus, Plus, Printer, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { buildSpreadsheetXml, buildXlsx } from "@/lib/utils/xlsx";
import { useGetQrrorReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { buildQrrorDocument, buildQrrorSheets, qrrorFileName, quarterLabel, splitPeriods, type QrrorDocOptions } from "./document";
import { QrrorFields, changeQrrorParam, emptyQrrorParams, qrrorFilterLabels, validateQrrorParams, type QrrorField } from "./QrrorParamFields";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { QRROR_PAGE_TITLE } from "./QrrorView";
import type { QrrorParams } from "./types";
import { useRecordGeneration } from "../hooks/useRecordGeneration";
import { getErrorMessage } from "@/lib/api/error-handler";

type Format = "pdf" | "xlsx" | "xls";
const OPTIONS: { key: keyof QrrorDocOptions; label: string }[] = [
  { key: "summary", label: "Include Summary Page" },
  { key: "details", label: "Include Detailed Transactions" },
  { key: "groupByClass", label: "Group by Revenue Classification" },
  { key: "previousQuarter", label: "Show Previous Quarter Comparison" },
  { key: "signatories", label: "Include Signatories Page" },
];
const FORMATS: { value: Format; label: string }[] = [
  { value: "pdf", label: "PDF (Recommended)" },
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "xls", label: "Excel (XLS)" },
];

function PanelTitle({ icon: Icon, children }: { icon: typeof Filter; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 rounded-lg bg-blue-50/70 py-1.5 pr-3 text-lg font-semibold text-blue-800">
      <span className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white"><Icon className="size-5" aria-hidden /></span>
      {children}
    </h2>
  );
}

/** Generate BFARS 10 (Quarterly Report of Revenue and Other Receipts): parameters and options on the left, a live paged preview on the right. */
export function QrrorGenerator() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const recordGeneration = useRecordGeneration("bfars-10");
  const [params, setParams] = useState<QrrorParams>(() => emptyQrrorParams(fy));
  const [errors, setErrors] = useState<Partial<Record<QrrorField, string>>>({});
  const [opts, setOpts] = useState<QrrorDocOptions>({ summary: true, details: true, groupByClass: true, previousQuarter: true, signatories: true });
  const [format, setFormat] = useState<Format>("pdf");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(0.6);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const valid = !Object.keys(validateQrrorParams(params)).length;
  const { data, isFetching, error, refetch } = useGetQrrorReportQuery(params, { skip: !valid });
  const nothingSelected = !opts.summary && !opts.details;

  const doc = useMemo(
    () =>
      data && valid
        ? buildQrrorDocument(data, opts, qrrorFilterLabels(params, data.options), { logoUrl: `${typeof window === "undefined" ? "" : window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) })
        : null,
    [data, valid, opts, params],
  );
  const pageCount = doc?.pageCount ?? 0;

  const onChange = (field: QrrorField, value: string) => {
    setParams((p) => changeQrrorParam(p, field, value));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setPage(1);
  };

  const goToPage = (n: number) => {
    if (!pageCount) return;
    const target = Math.min(Math.max(n, 1), pageCount);
    setPage(target);
    frameRef.current?.contentDocument?.getElementById(`page-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const generate = async () => {
    const errs = validateQrrorParams(params);
    setErrors(errs);
    if (Object.keys(errs).length) {
      notify("error", "Unable to generate the report", "Complete the required parameters.");
      return;
    }
    if (nothingSelected) {
      notify("error", "Nothing to include", "Select the summary page or the detailed transactions.");
      return;
    }
    setBusy(true);
    try {
      const report = await refetch().unwrap();
      if (!splitPeriods(report.rows, report.quarter).current.length) notify("warning", "No receipts", `No revenue or other receipts are recorded for the ${quarterLabel(report.fiscalYear, report.quarter)} with the selected parameters.`);
      if (format === "pdf") {
        printDocument(buildQrrorDocument(report, opts, qrrorFilterLabels(params, report.options), { logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) }).html);
        notify("success", "Report generated", "Choose “Save as PDF” in the print dialog to save the PDF.");
      } else {
        const sheets = buildQrrorSheets(report, opts, qrrorFilterLabels(params, report.options));
        if (format === "xlsx") downloadFile(qrrorFileName(report, "xlsx"), buildXlsx(sheets), XLSX_MIME);
        else downloadFile(qrrorFileName(report, "xls"), buildSpreadsheetXml(sheets), "application/vnd.ms-excel");
        notify("success", "Report generated", `${qrrorFileName(report, format)} was downloaded.`);
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
      <PageHeader title={QRROR_PAGE_TITLE} description="Generate and preview the official BFARS 10 report showing quarterly revenue and other receipts." extraCrumbs={["Generate Report"]} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <Card className="space-y-5 self-start p-5">
          <PanelTitle icon={Filter}>Report Parameters</PanelTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <QrrorFields params={params} onChange={onChange} options={data?.options} errors={errors} />
          </div>
          <PanelTitle icon={Settings}>Display Options</PanelTitle>
          <fieldset className="space-y-2.5">
            <legend className="sr-only">Display options</legend>
            {OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-2.5 text-sm text-blue-800">
                <input type="checkbox" className="size-[18px] accent-blue-600" checked={opts[o.key]} onChange={(e) => { setOpts((s) => ({ ...s, [o.key]: e.target.checked })); setPage(1); }} />
                {o.label}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2.5 border-t border-gray-100 pt-4">
            <legend className="mb-2 text-lg font-semibold text-blue-800">Output Format</legend>
            {FORMATS.map((f) => (
              <label key={f.value} className="flex items-center gap-2.5 text-sm text-blue-800">
                <input type="radio" name="format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} className="size-[18px] accent-blue-600" />
                {f.label}
              </label>
            ))}
          </fieldset>
          <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700" onClick={generate} loading={busy} disabled={busy}>{!busy && <FileText className="size-4" />} Generate Report</Button>
        </Card>

        <div ref={shellRef} className="flex min-h-[720px] flex-col overflow-hidden rounded-xl bg-gray-800 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-white">
            <FileText className="size-5" aria-hidden />
            <button type="button" className={tool} onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ArrowLeft className="size-4" /></button>
            <button type="button" className={tool} onClick={() => goToPage(page + 1)} disabled={page >= pageCount} aria-label="Next page"><ArrowRight className="size-4" /></button>
            <label htmlFor="qrror-page" className="sr-only">Page</label>
            <input id="qrror-page" type="number" min={1} max={pageCount || 1} value={page} onChange={(e) => goToPage(Number(e.target.value))} className="h-8 w-12 rounded bg-gray-700 text-center" />
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
                title="BFARS 10 report preview"
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
