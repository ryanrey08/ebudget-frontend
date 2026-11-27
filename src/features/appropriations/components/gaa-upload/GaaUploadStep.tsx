"use client";

import { useRef, useState } from "react";
import { CloudUpload, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormAlert } from "@/components/forms/FormAlert";
import { useCan } from "@/hooks/useCan";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { formatFileSize } from "@/lib/utils/format";
import { useAppDispatch } from "@/store/hooks";
import { useValidateGaaUploadMutation } from "../../services/appropriationLinesApi";
import { reportReceived } from "../../state/gaaWizardSlice";
import { GAA_CELL_FIELDS, GAA_CELL_HEADINGS } from "../../types/lines";

const MAX_BYTES = 5 * 1024 * 1024;
const TEMPLATE = "/templates/ebudget-gaa-upload-template.xlsx";

export function GaaUploadStep() {
  const dispatch = useAppDispatch();
  const notify = useNotify();
  const canManage = useCan("appropriations.manage");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [validate, { isLoading }] = useValidateGaaUploadMutation();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const choose = (f: File | undefined) => {
    setErrors([]);
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return setErrors(["The file must be an Excel workbook (.xlsx)."]);
    if (f.size > MAX_BYTES) return setErrors(["The file can be at most 5 MB."]);
    setFile(f);
  };

  const submit = async () => {
    if (!file) return;
    setErrors([]);
    try {
      const report = await validate(file).unwrap();
      dispatch(reportReceived({ fileName: file.name, report }));
      notify(report.valid ? "success" : "warning", report.valid ? "Every row is valid" : `${report.summary.invalid_rows} row(s) need corrections`, file.name);
    } catch (err) {
      // 422 on `file`: not the template, wrong headings, no rows… (one message per problem).
      if (isApiError(err) && err.fieldErrors?.file) setErrors(Object.values(err.fieldErrors));
      else setErrors([getErrorMessage(err)]);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader title="Upload the GAA workbook" description="The eBudget GAA template (.xlsx, up to 5 MB and 5,000 rows). Only the “GAA Upload” sheet is read." />
        <CardBody className="space-y-4">
          {!canManage && <FormAlert tone="info">You need the appropriations.manage permission to upload GAA files.</FormAlert>}
          {errors.length > 0 && (
            <FormAlert>
              <ul className="list-disc space-y-0.5 pl-4">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </FormAlert>
          )}
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files[0]);
            }}
            className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"}`}
          >
            <CloudUpload className="mb-3 size-10 text-gray-400" aria-hidden />
            <span className="font-medium text-gray-900">Drop the workbook here or click to choose it</span>
            <span className="mt-1 text-sm text-gray-500">.xlsx only, checked by content</span>
          </button>
          <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
          {file && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
              <FileSpreadsheet className="size-6 text-green-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                Remove
              </Button>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <a href={TEMPLATE} download className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="size-4" /> Download template
            </a>
            <Button onClick={submit} disabled={!file || !canManage} loading={isLoading}>
              Validate file
            </Button>
          </div>
          <p className="text-xs text-gray-500">Validation saves nothing. You can correct rows on the next step before importing.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Template columns" description="Headings on row 4, data from row 5. Cells must hold values, not formulas." />
        <CardBody>
          <ul className="space-y-1.5 text-sm">
            {GAA_CELL_FIELDS.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="w-5 font-mono text-gray-400">{GAA_CELL_HEADINGS[f].column}</span>
                <span className="text-gray-700">
                  {GAA_CELL_HEADINGS[f].heading}
                  {GAA_CELL_HEADINGS[f].required && <span className="ml-0.5 text-brand-600">*</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Codes are matched to active master data. Allotment Class takes the code (PS) or the registry (RAOPS). Appropriation Type takes New (= GAA) or a type such as supplemental.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
