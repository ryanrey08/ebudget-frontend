"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Eye, FileCog, FileText, Info, Minus, Plus, Printer, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { useGetQproReportQuery, useLazyGetQproReportQuery } from "../services/bfarsApi";
import {
  buildQproDocument,
  buildQproSpreadsheet,
  downloadFile,
  printDocument,
  qproFileName,
  toWordDocument,
  type QproDocOptions,
  type ReportFormat,
} from "./document";
import { ParamSelect, QproMainFields, validateQproParams, type QproField } from "./QproParamFields";
import { emptyParams } from "./QproView";
import type { QproParams, QproReport } from "./types";
import { useRecordGeneration } from "../hooks/useRecordGeneration";

const FORMATS: { value: ReportFormat; label: string; hint: string }[] = [
  { value: "pdf", label: "PDF", hint: "(Recommended for submission)" },
  { value: "excel", label: "Excel", hint: "(Editable)" },
  { value: "word", label: "Word", hint: "(For review/drafting)" },
];
const SCOPES: { value: QproDocOptions["scope"]; label: string; hint?: string }[] = [
  { value: "both", label: "Summary and Details", hint: "(All Programs/Activities)" },
  { value: "summary", label: "Summary Only" },
  { value: "details", label: "Details Only" },
];
const INCLUDES: { key: keyof QproDocOptions["include"]; label: string }[] = [
  { key: "cover", label: "Cover Page" },
  { key: "summary", label: "Summary of Physical and Financial Accomplishment" },
  { key: "details", label: "Details per Program/Activity/Project" },
  { key: "signature", label: "Signature Page" },
];

function Section({ icon: Icon, tone, title, children }: { icon: typeof Info; tone: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-3 rounded-lg bg-blue-50/60 py-1.5 pr-3 text-lg font-semibold text-gray-900">
        <span className={cn("flex size-10 items-center justify-center rounded-lg text-white", tone)}><Icon className="size-5" aria-hidden /></span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Radio<T extends string>({ name, legend, value, onChange, items }: { name: string; legend: string; value: T; onChange: (v: T) => void; items: { value: T; label: string; hint?: string }[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-blue-900">{legend}</legend>
      <div className="space-y-2">
        {items.map((it) => (
          <label key={it.value} className="flex items-center gap-2.5 text-sm text-gray-900">
            <input type="radio" name={name} value={it.value} checked={value === it.value} onChange={() => onChange(it.value)} className="size-[18px] accent-blue-600" />
            <span>{it.label} {it.hint && <span className="text-blue-600">{it.hint}</span>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Generate BFARS 1 (QPRO): parameters, report options and a paged preview. */
export function QproGenerator() {
  const router = useRouter();
  const notify = useNotify();
  const recordGeneration = useRecordGeneration("bfars-1");
  const user = useAppSelector(selectCurrentUser);
  const fy = useFiscalYear();
  const [params, setParams] = useState<QproParams>(() => emptyParams(fy));
  const [errors, setErrors] = useState<Partial<Record<QproField, string>>>({});
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [layout, setLayout] = useState<QproDocOptions["layout"]>("portrait");
  const [scope, setScope] = useState<QproDocOptions["scope"]>("both");
  const [include, setInclude] = useState<QproDocOptions["include"]>({ cover: true, summary: true, details: true, signature: true });
  const [preview, setPreview] = useState<{ html: string; pageCount: number; report: QproReport; stale: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(0.5);
  const [busy, setBusy] = useState<"preview" | "generate" | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const options = useGetQproReportQuery(emptyParams(fy)).data?.options;
  const [fetchReport] = useLazyGetQproReportQuery();

  const opts: QproDocOptions = { layout, scope, include };
  const ctx = () => ({ logoUrl: `${window.location.origin}/brand/ebudget-emblem.png`, preparedBy: user ? `${user.firstName} ${user.lastName}` : "eBudget", generatedAt: formatDateTime(new Date().toISOString()) });

  // Any change after a preview marks it out of date.
  const markStale = () => setPreview((p) => (p && !p.stale ? { ...p, stale: true } : p));
  const onChange = (field: QproField, value: string) => {
    setParams((p) => ({ ...p, [field]: field === "fiscalYear" ? Number(value) || 0 : value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    markStale();
  };
  useEffect(markStale, [format, layout, scope, include]);

  const validate = () => {
    const errs = validateQproParams(params);
    setErrors(errs);
    if (Object.keys(errs).length) return false;
    if (!Object.values(include).some(Boolean)) {
      notify("error", "Nothing to include", "Select at least one section under Include in Report.");
      return false;
    }
    if ((scope === "summary" && !include.summary) || (scope === "details" && !include.details)) {
      notify("warning", "Check the report scope", `The ${scope === "summary" ? "summary" : "details"} section is not ticked under Include in Report.`);
    }
    return true;
  };

  const load = async () => {
    const report = await fetchReport(params).unwrap();
    const doc = buildQproDocument(report, opts, ctx());
    setPreview({ ...doc, report, stale: false });
    setPage(1);
    return { report, doc };
  };

  const onPreview = async () => {
    if (!validate()) return;
    setBusy("preview");
    try {
      const { report, doc } = await load();
      notify(report.rows.length ? "success" : "warning", report.rows.length ? "Preview ready" : "No matching records", `${doc.pageCount} page(s) • ${report.rows.length} record(s)`);
    } catch (err) {
      notify("error", "Unable to preview the report", getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onGenerate = async () => {
    if (!validate()) return;
    setBusy("generate");
    try {
      const { report, doc } = await load();
      if (format === "pdf") {
        printDocument(doc.html);
        notify("success", "Report generated", "Choose “Save as PDF” in the print dialog to save the PDF.");
      } else if (format === "excel") {
        downloadFile(qproFileName(report, "xls"), buildQproSpreadsheet(report, opts), "application/vnd.ms-excel");
        notify("success", "Report generated", `${qproFileName(report, "xls")} was downloaded.`);
      } else {
        downloadFile(qproFileName(report, "doc"), toWordDocument(doc.html), "application/msword");
        notify("success", "Report generated", `${qproFileName(report, "doc")} was downloaded.`);
      }
      recordGeneration(params, format);
    } catch (err) {
      notify("error", "Unable to generate the report", getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const goToPage = (n: number) => {
    if (!preview) return;
    const target = Math.min(Math.max(n, 1), preview.pageCount);
    setPage(target);
    frameRef.current?.contentDocument?.getElementById(`page-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const onFrameScroll = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !preview) return;
    const top = doc.documentElement.scrollTop + 40;
    let current = 1;
    for (let i = 1; i <= preview.pageCount; i++) if ((doc.getElementById(`page-${i}`)?.offsetTop ?? Infinity) * zoom <= top) current = i;
    setPage(current);
  };
  const frameHtml = preview ? preview.html.replace("</style>", `body{zoom:${zoom}}</style>`) : "";

  return (
    <>
      <PageHeader
        title="Generate BFARS 1 – Quarterly Physical Reports of Operation (QPRO)"
        description="Select the parameters and options to generate the report."
        extraCrumbs={["Generate Report"]}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="space-y-6 p-5">
          <Section icon={SlidersHorizontal} tone="bg-blue-600" title="Report Parameters">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <QproMainFields params={params} onChange={onChange} options={options} errors={errors} allLabels={{ department: "All Departments/Offices", uacsMajor: "All UACS (Major)", allotmentClass: "All Allotment Classes" }} />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h3 className="mb-3 font-semibold text-gray-900">Additional Filters (Optional)</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <ParamSelect field="pap" label="Program/Activity/Project" value={params.pap} onChange={onChange} allLabel="All Programs/Activities/Projects" options={(options?.paps ?? []).map((p) => ({ value: p.code, label: `${p.code} – ${p.title}` }))} />
                <ParamSelect field="fundSource" label="Funding Source" value={params.fundSource} onChange={onChange} allLabel="All" options={(options?.fundSources ?? []).map((f) => ({ value: f.code, label: `${f.code} – ${f.name}` }))} />
                <ParamSelect field="status" label="Status" value={params.status} onChange={onChange} allLabel="All" options={(options?.statuses ?? []).map((s) => ({ value: s, label: s }))} />
              </div>
            </div>
          </Section>

          <Section icon={FileCog} tone="bg-green-600" title="Report Options">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-5">
                <Radio name="format" legend="Report Format" value={format} onChange={setFormat} items={FORMATS} />
                <Radio name="layout" legend="Report Layout" value={layout} onChange={setLayout} items={[{ value: "portrait", label: "Portrait", hint: "(Recommended)" }, { value: "landscape", label: "Landscape" }]} />
              </div>
              <div className="space-y-5">
                <Radio name="scope" legend="Report Scope" value={scope} onChange={setScope} items={SCOPES} />
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-blue-900">Include in Report</legend>
                  <div className="space-y-2">
                    {INCLUDES.map((it) => (
                      <label key={it.key} className="flex items-center gap-2.5 text-sm text-gray-900">
                        <input type="checkbox" checked={include[it.key]} onChange={(e) => setInclude((s) => ({ ...s, [it.key]: e.target.checked }))} className="size-[18px] accent-blue-600" />
                        {it.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-white" aria-hidden>!</span>
              <p><span className="block font-semibold">Note:</span>The BFARS 1 – Quarterly Physical Reports of Operation (QPRO) will be generated based on the selected parameters. Figures are sample data.</p>
            </div>
          </Section>
        </Card>

        <Card className="flex min-h-[640px] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900"><span className="flex size-10 items-center justify-center rounded-lg bg-purple-600 text-white"><FileText className="size-5" aria-hidden /></span> Report Preview</h2>
            {preview && <span className={cn("rounded-lg border px-3 py-1 text-sm font-medium", preview.stale ? "border-amber-300 bg-amber-50 text-amber-800" : "border-green-300 bg-green-50 text-green-700")}>{preview.stale ? "Out of date – preview again" : "PDF Preview"}</span>}
          </div>
          {preview ? (
            <div className="mx-3 mb-3 flex flex-1 flex-col overflow-hidden rounded-lg bg-gray-700">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-white">
                <label htmlFor="preview-page" className="sr-only">Page</label>
                <input id="preview-page" type="number" min={1} max={preview.pageCount} value={page} onChange={(e) => goToPage(Number(e.target.value))} className="h-8 w-12 rounded bg-gray-800 text-center" />
                <span>/ {preview.pageCount}</span>
                <span className="mx-1 h-5 w-px bg-gray-500" aria-hidden />
                <button type="button" onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))} className="rounded p-1 hover:bg-gray-600" aria-label="Zoom out"><Minus className="size-4" /></button>
                <span className="w-12 rounded bg-gray-800 px-1 py-1 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))} className="rounded p-1 hover:bg-gray-600" aria-label="Zoom in"><Plus className="size-4" /></button>
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => downloadFile(qproFileName(preview.report, "html"), preview.html, "text/html")} className="rounded p-1.5 hover:bg-gray-600" aria-label="Download preview" title="Download preview (HTML)"><Download className="size-4" /></button>
                  <button type="button" onClick={() => printDocument(preview.html)} className="rounded p-1.5 hover:bg-gray-600" aria-label="Print preview" title="Print"><Printer className="size-4" /></button>
                </span>
              </div>
              <iframe
                ref={frameRef}
                title="BFARS 1 report preview"
                srcDoc={frameHtml}
                className="min-h-[560px] w-full flex-1 bg-gray-200"
                onLoad={() => {
                  frameRef.current?.contentWindow?.addEventListener("scroll", onFrameScroll);
                  goToPage(page);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-5">
              <EmptyState title="No preview yet" description="Select the parameters and options, then click Preview Report." />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <Button variant="outline" size="lg" className="border-blue-600 text-blue-700" onClick={() => router.push(ROUTES.bfars("bfars-1"))}><ArrowLeft className="size-4" /> Back</Button>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="lg" className="border-blue-600 text-blue-700" onClick={onPreview} loading={busy === "preview"} disabled={!!busy}>{busy !== "preview" && <Eye className="size-4" />} Preview Report</Button>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={onGenerate} loading={busy === "generate"} disabled={!!busy}>{busy !== "generate" && <FileText className="size-4" />} Generate Report</Button>
        </div>
      </div>
    </>
  );
}
