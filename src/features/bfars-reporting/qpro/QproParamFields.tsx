"use client";

import { Select } from "@/components/ui/Select";
import { FISCAL_YEARS } from "@/config/site";
import { cn } from "@/lib/utils/cn";
import type { QproParams, QproReport } from "./types";

export const QUARTERS = [
  { value: "Q1", label: "1st Quarter (Jan – Mar)" },
  { value: "Q2", label: "2nd Quarter (Apr – Jun)" },
  { value: "Q3", label: "3rd Quarter (Jul – Sep)" },
  { value: "Q4", label: "4th Quarter (Oct – Dec)" },
];
export const CLASS_OPTIONS = ["RAOPS", "RAOMO", "RAOCO", "RAOFE"].map((c) => ({ value: c, label: c }));

export type QproField = keyof QproParams;

/** Labelled select for one report parameter. "" means All. */
export function ParamSelect({
  field,
  label,
  value,
  onChange,
  options,
  allLabel,
  required,
  error,
  className,
}: {
  field: QproField;
  label: string;
  value: string;
  onChange: (field: QproField, value: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
  required?: boolean;
  error?: string;
  className?: string;
}) {
  const id = `qpro-${field}`;
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-brand-600">*</span>}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={allLabel}
        options={options}
        invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** The five main report parameters shared by the QPRO page and the report generator. */
export function QproMainFields({
  params,
  onChange,
  options,
  errors,
  allLabels,
}: {
  params: QproParams;
  onChange: (field: QproField, value: string) => void;
  options?: QproReport["options"];
  errors: Partial<Record<QproField, string>>;
  allLabels?: Partial<Record<QproField, string>>;
}) {
  return (
    <>
      <ParamSelect field="fiscalYear" label="Fiscal Year" required value={String(params.fiscalYear || "")} onChange={onChange} error={errors.fiscalYear} allLabel="Select fiscal year" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />
      <ParamSelect field="quarter" label="Quarter" required value={params.quarter} onChange={onChange} error={errors.quarter} allLabel="Select quarter" options={QUARTERS} />
      <ParamSelect field="department" label="Department/Office" value={params.department} onChange={onChange} allLabel={allLabels?.department ?? "All"} options={(options?.departments ?? []).map((d) => ({ value: d, label: d }))} />
      <ParamSelect field="uacsMajor" label="UACS (Major)" value={params.uacsMajor} onChange={onChange} allLabel={allLabels?.uacsMajor ?? "All"} options={(options?.uacsMajors ?? []).map((u) => ({ value: u, label: u }))} />
      <ParamSelect field="allotmentClass" label="Allotment Class" value={params.allotmentClass} onChange={onChange} allLabel={allLabels?.allotmentClass ?? "All"} options={CLASS_OPTIONS} />
    </>
  );
}

export function validateQproParams(p: QproParams): Partial<Record<QproField, string>> {
  const errors: Partial<Record<QproField, string>> = {};
  if (!p.fiscalYear) errors.fiscalYear = "Select the fiscal year";
  if (!p.quarter) errors.quarter = "Select the quarter";
  return errors;
}
