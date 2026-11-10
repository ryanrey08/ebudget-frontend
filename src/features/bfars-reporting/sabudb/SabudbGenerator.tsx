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
import { useGetSabudbReportQuery } from "../services/bfarsApi";
import { downloadFile, printDocument } from "../qpro/document";
import { SaaodbFields, emptySaaodbParams, filterLabels, validateSaaodbParams, type SaaodbField } from "../saaodb/SaaodbParamFields";
import { XLSX_MIME } from "../saaodb/SaaodbView";
import { buildSabudbDocument, buildSabudbSheets, sabudbFileName, type SabudbDocOptions } from "./document";
import { SABUDB_FIELD_ORDER, SABUDB_PAGE_TITLE } from "./SabudbView";
import type { SabudbParams, SabudbReport } from "./types";
import { useRecordGeneration } from "../hooks/useRecordGeneration";
import { getErrorMessage } from "@/lib/api/error-handler";

type Format = "pdf" | "xlsx" | "xls";
type OptionKey = Exclude<keyof SabudbDocOptions, "view">;
const OPTIONS: { key: OptionKey; label: string; detailedOnly?: boolean }[] = [
  { key: "cover", label: "Include Cover Page" },
  { key: "signature", label: "Include Signature Page" },
  { key: "groupByClass", label: "Group by Allotment Class", detailedOnly: true },
  { key: "groupByObject", label: "Group by Object of Expenditure", detailedOnly: true },
  { key: "previousYear", label: "Include Previous Year Comparison" },
  { key: "notes", label: "Include Notes/Remarks" },
];
const VIEWS: { value: SabudbDocOptions["view"]; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "detailed", label: "Detailed (by UACS)" },
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

const docContext = () => ({ logoUrl: `${typeof window === "undefined" ? "" : window.location.origin}/brand/ebudget-emblem.png`, generatedAt: formatDateTime(new Date().toISOString()) });

/** Generate BFARS 6 (SABUDB): parameters and options on the left, a live paged preview on the right. */
export function SabudbGenerator() {
  const fy = useFiscalYear();
  const notify = useNotify();
  const recordGeneration = useRecordGeneration("bfars-6");
  const [params, setParams] = useState<SabudbParams>(() => emptySaaodbParams(fy));
  const [errors, setErrors] = useState<Partial<Record<SaaodbField, string>>>({});
  const [opts, setOpts] = useState<SabudbDocOptions>({ view: "detailed", cover: true, signature: true, groupByClass: true, groupByObject: false, previousYear: false, notes: true });
  const [format, setFormat] = useState<Format>("pdf");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(0.8);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const valid = !Object.keys(validateSaaodbParams(params)).length;
  const { data, isFetching, error, refetch } = useGetSabudbReportQuery(params, { skip: !valid });

  const doc = useMemo(() => (data && valid ? buildSabudbDocument(data, opts, filterLabels(params, data.options), docContext()) : null), [data, valid, opts, params]);
  const pageCount = doc?.pageCount ?? 0;

  const onChange = (field: SaaodbField, value: string) => {
    setParams((p) => ({ ...p, [field]: field === "fiscalYear" ? Number(value) || 0 : value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setPage(1);
  };

  const goToPage = (n: number) => {
    if (!pageCount) return;
    const target = Math.min(Math.max(n, 1), pageCount);
    setPage(target);
    // Scroll only the preview frame (scrollIntoView would also scroll the app page).
    const el = frameRef.current?.contentDocument?.getElementById(`page-${target}`);
    if (el) frameRef.current?.contentWindow?.scrollTo({ top: (el.offsetTop - 12) * zoom, behavior: "smooth" });
  };

  const output = (report: SabudbReport) => {
    const labels = filterLabels(params, report.options);
    if (format === "pdf") {
      printDocument(buildSabudbDocument(report, opts, labels, docContext()).html);
      notify("success", "Report generated", "Choose “Save as PDF” in the print dialog to save the PDF.");
      return;
    }
    const sheets = buildSabudbSheets(report, opts, labels);
    if (format === "xlsx") downloadFile(sabudbFileName(report, "xlsx"), buildXlsx(sheets), XLSX_MIME);
    else downloadFile(sabudbFileName(report, "xls"), buildSpreadsheetXml(sheets), "application/vnd.ms-excel");
    notify("success", "Report generated", `${sabudbFileName(report, format)} was downloaded.`);
  };

  const generate = async () => {
    const errs = validateSaaodbParams(params);
    setErrors(errs);
    if (Object.keys(errs).length) {
      notify("error", "Missing report parameters", "Select the fiscal year and quarter.");
      return;
    }
    setBusy(true);
    try {
      const report = await refetch().unwrap();
      if (!report.rows.length) notify("warning", "No matching records", "The report has no lines for the selected parameters.");
      output(report);
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
      <PageHeader title={SABUDB_PAGE_TITLE} description="Generate and preview the official BFARS 6 report for the selected parameters." extraCrumbs={["Generate Report"]} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <Card className="space-y-5 self-start p-5">
          <PanelTitle icon={Filter}>Report Parameters</PanelTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <SaaodbFields params={params} onChange={onChange} options={data?.options} errors={errors} order={SABUDB_FIELD_ORDER} />
          </div>
          <fieldset className="space-y-2.5">
            <legend className="mb-2 font-medium text-blue-800">View By</legend>
            {VIEWS.map((v) => (
              <label key={v.value} className="flex items-center gap-2.5 text-sm text-blue-800">
                <input type="radio" name="sabudb-view" value={v.value} checked={opts.view === v.value} onChange={() => { setOpts((s) => ({ ...s, view: v.value })); setPage(1); }} className="size-[18px] accent-blue-600" />
                {v.label}
              </label>
            ))}
          </fieldset>
          <PanelTitle icon={Settings}>Report Options</PanelTitle>
          <fieldset className="space-y-2.5">
            <legend className="sr-only">Report options</legend>
            {OPTIONS.map((o) => {
              const disabled = o.detailedOnly && opts.view !== "detailed";
              return (
                <label key={o.key} className={cn("flex items-center gap-2.5 text-sm text-blue-800", disabled && "opacity-50")} title={disabled ? "Available in the Detailed (by UACS) view" : undefined}>
                  <input type="checkbox" className="size-[18px] accent-blue-600" checked={opts[o.key]} disabled={disabled} onChange={(e) => { setOpts((s) => ({ ...s, [o.key]: e.target.checked })); setPage(1); }} />
                  {o.label}
                </label>
              );
            })}
          </fieldset>
          <fieldset className="space-y-2.5 border-t border-gray-100 pt-4">
            <legend className="mb-2 text-lg font-semibold text-blue-800">Output Format</legend>
            {FORMATS.map((f) => (
              <label key={f.value} className="flex items-center gap-2.5 text-sm text-blue-800">
                <input type="radio" name="sabudb-format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} className="size-[18px] accent-blue-600" />
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
            <label htmlFor="sabudb-page" className="sr-only">Page</label>
            <input id="sabudb-page" type="number" min={1} max={pageCount || 1} value={page} onChange={(e) => goToPage(Number(e.target.value))} className="h-8 w-12 rounded bg-gray-700 text-center" />
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
                title="BFARS 6 report preview"
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
