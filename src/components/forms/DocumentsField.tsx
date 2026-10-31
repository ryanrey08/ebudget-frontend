"use client";

import { useRef, useState, type DragEvent } from "react";
import { CloudUpload, FileImage, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatFileSize } from "@/lib/utils/format";
import type { AppropriationDocument } from "@/features/appropriations/types";

const ACCEPT = [".pdf", ".xlsx", ".xls", ".jpg", ".jpeg", ".png"];
const MAX_SIZE = 10 * 1024 * 1024;

function iconFor(name: string) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (ext === ".pdf") return { Icon: FileText, className: "bg-red-600", label: "PDF File" };
  if (ext === ".xlsx" || ext === ".xls") return { Icon: FileSpreadsheet, className: "bg-green-700", label: "Excel File" };
  return { Icon: FileImage, className: "bg-blue-600", label: "Image File" };
}

/** Drag-and-drop document picker; `upload` sends one file to the API and returns its record. */
export function DocumentsField({
  documents,
  onChange,
  upload,
  compact,
}: {
  documents: AppropriationDocument[];
  onChange: (documents: AppropriationDocument[]) => void;
  upload: (file: File) => Promise<AppropriationDocument>;
  /** Stack the drop zone above the file list (for narrow side panels). */
  compact?: boolean;
}) {
  const notify = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let next = [...documents];
    for (const file of Array.from(files)) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPT.includes(ext)) {
        notify("error", "Unsupported file", `${file.name}: accepted formats are PDF, Excel, JPG and PNG.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        notify("error", "File too large", `${file.name} is larger than 10 MB.`);
        continue;
      }
      setIsLoading(true);
      try {
        next = [...next, await upload(file)];
        onChange(next);
      } catch (err) {
        notify("error", `Unable to upload ${file.name}`, getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  return (
    <div className={cn("grid grid-cols-1 gap-4", !compact && "lg:grid-cols-2")}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center",
          dragging ? "border-brand-500 bg-brand-50" : "border-gray-300",
        )}
      >
        {isLoading ? <Spinner className="size-8 text-blue-600" label="Uploading…" /> : <CloudUpload className="size-9 text-blue-600" strokeWidth={1.5} aria-hidden />}
        <p className="mt-2 text-sm text-gray-700">
          Drag and drop files here, or{" "}
          <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-blue-600 hover:underline">
            click to upload
          </button>
        </p>
        <p className="mt-1 text-xs text-gray-500">Accepted formats: PDF, Excel, JPG, PNG (Max 10MB per file)</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="sr-only"
          aria-label="Upload supporting documents"
          onChange={(e) => void addFiles(e.target.files)}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-gray-800">Uploaded Files ({documents.length})</p>
        {documents.length === 0 ? (
          <p className="rounded-lg border border-gray-200 px-3 py-4 text-sm text-gray-500">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => {
              const { Icon, className, label } = iconFor(d.name);
              return (
                <li key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded text-white", className)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{d.name}</span>
                    <span className="block text-xs text-gray-500">
                      {label} · {formatFileSize(d.size)} · {formatDateTime(d.uploadedAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(documents.filter((x) => x.id !== d.id))}
                    className="rounded-md p-1.5 text-brand-600 hover:bg-red-50"
                    aria-label={`Remove ${d.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
