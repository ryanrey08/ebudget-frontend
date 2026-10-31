"use client";

import { useRef, useState, type DragEvent } from "react";
import { CheckCircle2, Download, FileSpreadsheet, FileText, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { FormAlert } from "@/components/forms/FormAlert";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAppDispatch } from "@/store/hooks";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDateTime, formatFileSize, formatNumber } from "@/lib/utils/format";
import {
  useDeleteGaaUploadMutation,
  useGetGaaRowsQuery,
  useGetGaaUploadsQuery,
  useUploadGaaMutation,
} from "../../services/gaaApi";
import { batchSelected, stepChanged, wizardReset } from "../../state/gaaWizardSlice";
import type { GaaUploadBatch } from "../../types";
import { gaaDataColumns } from "./gaaColumns";

const ACCEPTED = [".xlsx", ".xls", ".csv"];
const MAX_SIZE = 20 * 1024 * 1024;

const REQUIREMENTS = [
  "Use the eBudget GAA template format",
  "Include Appropriations, Programs/Activities, and Object of Expenditures",
  "Must contain Fund Source and Allotment Class",
  "Data should be on the first sheet",
  "No merged cells in data rows",
];

function validateFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ACCEPTED.includes(ext)) return "Unsupported file type. Upload a Microsoft Excel (.xlsx, .xls) or .csv file.";
  if (file.size > MAX_SIZE) return "File is larger than 20 MB.";
  if (file.size === 0) return "The selected file is empty.";
  return null;
}

export function UploadStep({ batch }: { batch?: GaaUploadBatch }) {
  const dispatch = useAppDispatch();
  const fiscalYear = useFiscalYear();
  const notify = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [uploadGaa, { isLoading: uploading, error: uploadError, reset }] = useUploadGaaMutation();
  const [deleteUpload, { isLoading: deleting }] = useDeleteGaaUploadMutation();

  const selectFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    const error = validateFile(file);
    setFileError(error);
    if (error) return;
    setPendingName(file.name);
    try {
      const created = await uploadGaa({ file, fiscalYear }).unwrap();
      dispatch(batchSelected({ batchId: created.id }));
      notify("success", "File uploaded", `${created.rowCount} records read from ${created.fileName}.`);
    } catch {
      // shown inline
    } finally {
      setPendingName(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void selectFile(e.dataTransfer.files[0]);
  };

  const onDelete = async () => {
    if (!batch) return;
    try {
      await deleteUpload(batch.id).unwrap();
      dispatch(wizardReset());
      notify("success", "Upload removed", batch.fileName);
    } catch (err) {
      notify("error", "Unable to remove upload", getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex h-full min-h-56 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              dragging ? "border-brand-500 bg-brand-50" : "border-gray-300",
            )}
          >
            <FileSpreadsheet className="size-14 text-green-700" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 font-semibold text-gray-900">Drag and drop your GAA file here</p>
            <p className="my-1 text-xs text-gray-500">or</p>
            <Button
              variant="outline"
              className="border-brand-600 px-8 font-semibold text-brand-600 hover:bg-brand-50"
              onClick={() => inputRef.current?.click()}
              loading={uploading}
            >
              {!uploading && <Upload className="size-4" />} {uploading ? "Uploading…" : "Choose File"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="sr-only"
              aria-label="Select GAA file"
              onChange={(e) => void selectFile(e.target.files?.[0])}
            />
            <p className="mt-4 text-sm text-gray-500">
              Supported format: Microsoft Excel (.xlsx, .xls) or CSV <span className="mx-2 text-gray-300">|</span>
              Maximum file size: 20 MB
            </p>
            {uploading && pendingName && (
              <div className="mt-4 w-full max-w-sm text-left">
                <p className="truncate text-xs text-gray-600">Uploading {pendingName}…</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-500" />
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <FileText className="size-5" aria-hidden /> GAA File Requirements
          </h2>
          <ul className="mt-4 space-y-2.5 rounded-lg bg-blue-50/60 p-4 text-sm text-gray-700">
            {REQUIREMENTS.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 fill-green-600 text-white" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="/templates/ebudget-gaa-upload-template.xlsx"
              download
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Download className="size-4" /> Download GAA Template (Excel)
            </a>
            <a href="/templates/ebudget-gaa-upload-template.csv" download className="text-sm font-medium text-blue-600 hover:underline">
              CSV version
            </a>
          </div>
        </Card>
      </div>

      {fileError && <FormAlert>{fileError}</FormAlert>}
      {uploadError && <FormAlert>{getErrorMessage(uploadError)}</FormAlert>}

      {batch ? (
        <>
          <UploadedFileBar batch={batch} onDelete={onDelete} deleting={deleting} />
          <DataPreview batch={batch} />
        </>
      ) : (
        <RecentUploads />
      )}
    </div>
  );
}

function UploadedFileBar({ batch, onDelete, deleting }: { batch: GaaUploadBatch; onDelete: () => void; deleting: boolean }) {
  return (
    <div className="grid items-center gap-4 rounded-xl border border-green-200 bg-green-50/70 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <CheckCircle2 className="size-8 shrink-0 fill-green-600 text-white" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-green-800">File Uploaded Successfully</p>
          <p className="truncate text-sm text-gray-700">
            {batch.fileName} <span className="ml-1 text-gray-500">({formatFileSize(batch.fileSize)})</span>
          </p>
        </div>
      </div>
      <Meta label="Uploaded By" value={batch.uploadedBy} />
      <Meta label="Date Uploaded" value={formatDateTime(batch.uploadedAt)} />
      <Meta label="No. of Records" value={`${formatNumber(batch.rowCount)} rows`} />
      {batch.status !== "Imported" && (
        <Button
          variant="primary"
          size="icon"
          onClick={onDelete}
          loading={deleting}
          aria-label={`Remove ${batch.fileName}`}
          className="justify-self-start xl:justify-self-end"
        >
          {!deleting && <Trash2 className="size-4" />}
        </Button>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="xl:border-l xl:border-green-200 xl:pl-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function DataPreview({ batch }: { batch: GaaUploadBatch }) {
  const dispatch = useAppDispatch();
  const rows = useGetGaaRowsQuery(batch.id);
  const paging = useClientPagination(rows.data, 10);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="GAA Data Preview"
        description="Review the uploaded GAA data. Click “Validate Data” to check for errors before importing."
        className="pb-4"
        action={
          <Button onClick={() => dispatch(stepChanged(batch.status === "Imported" ? "import" : "validate"))}>
            <Search className="size-4" /> {batch.status === "Imported" ? "View Import Results" : "Validate Data"}
          </Button>
        }
      />
      <DataTable
        dense
        columns={gaaDataColumns}
        rows={paging.pageItems}
        rowKey={(r) => String(r.rowNo)}
        loading={rows.isLoading}
        error={rows.error}
        onRetry={rows.refetch}
        caption="GAA data preview"
      />
      {paging.total > 0 && (
        <div className="border-t border-gray-100">
          <Pagination
            page={paging.page}
            pageSize={paging.pageSize}
            total={paging.total}
            onPageChange={paging.setPage}
            pageSizeOptions={[10, 25, 50]}
            onPageSizeChange={paging.setPageSize}
          />
        </div>
      )}
    </Card>
  );
}

function RecentUploads() {
  const dispatch = useAppDispatch();
  const uploads = useGetGaaUploadsQuery();

  const columns: Column<GaaUploadBatch>[] = [
    {
      key: "file",
      header: "File",
      cell: (b) => (
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 shrink-0 text-green-600" aria-hidden />
          <span className="font-medium text-gray-900">{b.fileName}</span>
        </span>
      ),
    },
    { key: "fy", header: "FY", cell: (b) => b.fiscalYear, hideBelow: "md" },
    { key: "uploaded", header: "Uploaded", cell: (b) => formatDateTime(b.uploadedAt), hideBelow: "lg" },
    { key: "by", header: "Uploaded By", cell: (b) => b.uploadedBy, hideBelow: "xl" },
    { key: "rows", header: "Rows", align: "right", cell: (b) => formatNumber(b.rowCount) },
    { key: "total", header: "Total Amount", align: "right", cell: (b) => formatCurrency(b.totalAmount), hideBelow: "md" },
    { key: "status", header: "Status", align: "center", cell: (b) => <StatusBadge status={b.status} /> },
    {
      key: "action",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (b) => (
        <button
          type="button"
          onClick={() =>
            dispatch(batchSelected({ batchId: b.id, step: b.status === "Imported" ? "import" : "upload" }))
          }
          className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          {b.status === "Imported" ? "View results" : "Continue"}
        </button>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Recent Uploads" description="Continue a previous upload or review an import." className="pb-4" />
      <DataTable
        columns={columns}
        rows={uploads.data}
        rowKey={(b) => b.id}
        loading={uploads.isLoading}
        error={uploads.error}
        onRetry={uploads.refetch}
        emptyTitle="No uploads yet"
        emptyDescription="Uploaded GAA files will appear here."
        caption="Recent GAA uploads"
      />
    </Card>
  );
}
