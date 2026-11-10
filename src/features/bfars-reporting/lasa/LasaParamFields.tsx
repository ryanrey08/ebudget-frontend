"use client";

import { FISCAL_YEARS } from "@/config/site";
import { CLASS_OPTIONS, ParamSelect, QUARTERS, type QproField } from "../qpro/QproParamFields";
import type { LasaFilterLabels } from "./document";
import { LASA_STATUSES, type LasaParams, type LasaReport } from "./types";

export type LasaField = keyof LasaParams;

export const emptyLasaParams = (fiscalYear: number): LasaParams => ({ fiscalYear, quarter: "Q1", department: "", allotmentClass: "", uacsMajor: "", status: "" });

export function validateLasaParams(p: LasaParams): Partial<Record<LasaField, string>> {
  const errors: Partial<Record<LasaField, string>> = {};
  if (!p.fiscalYear) errors.fiscalYear = "Select the fiscal year";
  if (!p.quarter) errors.quarter = "Select the quarter";
  return errors;
}

/** Display labels for the current filters ("All …" when empty). */
export function lasaFilterLabels(p: LasaParams, options?: LasaReport["options"]): LasaFilterLabels {
  return {
    department: p.department || "All Departments",
    uacsMajor: options?.uacsMajors.find((u) => u.code === p.uacsMajor)?.label ?? "All",
    allotmentClass: p.allotmentClass || "All",
    status: p.status || "All",
  };
}

/** Report parameter selects shared by the BFARS 4 page and the report generator. */
export function LasaFields({
  params,
  onChange,
  options,
  errors,
  fields,
}: {
  params: LasaParams;
  onChange: (field: LasaField, value: string) => void;
  options?: LasaReport["options"];
  errors: Partial<Record<LasaField, string>>;
  fields: LasaField[];
}) {
  const change = (f: QproField, v: string) => onChange(f as LasaField, v);
  const all: Record<LasaField, React.ReactNode> = {
    fiscalYear: <ParamSelect key="fy" field="fiscalYear" label="Fiscal Year" required value={String(params.fiscalYear || "")} onChange={change} error={errors.fiscalYear} allLabel="Select fiscal year" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />,
    quarter: <ParamSelect key="q" field="quarter" label="Quarter" required value={params.quarter} onChange={change} error={errors.quarter} allLabel="Select quarter" options={QUARTERS} />,
    department: <ParamSelect key="d" field="department" label="Department/Office" value={params.department} onChange={change} allLabel="All Departments" options={(options?.departments ?? []).map((d) => ({ value: d, label: d }))} />,
    allotmentClass: <ParamSelect key="c" field="allotmentClass" label="Allotment Class" value={params.allotmentClass} onChange={change} allLabel="All" options={CLASS_OPTIONS} />,
    uacsMajor: <ParamSelect key="u" field="uacsMajor" label="UACS (Major)" value={params.uacsMajor} onChange={change} allLabel="All" options={(options?.uacsMajors ?? []).map((u) => ({ value: u.code, label: u.label }))} />,
    status: <ParamSelect key="s" field="status" label="Status" value={params.status} onChange={change} allLabel="All" options={LASA_STATUSES.map((s) => ({ value: s, label: s }))} />,
  };
  return <>{fields.map((f) => all[f])}</>;
}
