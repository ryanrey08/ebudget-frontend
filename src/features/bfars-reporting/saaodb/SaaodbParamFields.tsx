"use client";

import { FISCAL_YEARS } from "@/config/site";
import { CLASS_OPTIONS, ParamSelect, QUARTERS, type QproField } from "../qpro/QproParamFields";
import type { SaaodbParams, SaaodbReport } from "./types";

export type SaaodbField = keyof SaaodbParams;

export const emptySaaodbParams = (fiscalYear: number): SaaodbParams => ({ fiscalYear, quarter: "Q1", department: "", uacsMajor: "", allotmentClass: "" });

export function validateSaaodbParams(p: SaaodbParams): Partial<Record<SaaodbField, string>> {
  const errors: Partial<Record<SaaodbField, string>> = {};
  if (!p.fiscalYear) errors.fiscalYear = "Select the fiscal year";
  if (!p.quarter) errors.quarter = "Select the quarter";
  return errors;
}

/** Display labels for the current filters ("All …" when empty). */
export function filterLabels(p: SaaodbParams, options?: SaaodbReport["options"]) {
  return {
    department: p.department || "All Departments",
    uacsMajor: options?.uacsMajors.find((u) => u.code === p.uacsMajor)?.label ?? "All",
    allotmentClass: p.allotmentClass || "All",
  };
}

/** Report parameter selects shared by the BFARS 2 page and the report generator. */
export function SaaodbFields({
  params,
  onChange,
  options,
  errors,
  order = ["fiscalYear", "department", "uacsMajor", "allotmentClass", "quarter"],
}: {
  params: SaaodbParams;
  onChange: (field: SaaodbField, value: string) => void;
  options?: SaaodbReport["options"];
  errors: Partial<Record<SaaodbField, string>>;
  order?: SaaodbField[];
}) {
  const change = (f: QproField, v: string) => onChange(f as SaaodbField, v);
  const fields: Record<SaaodbField, React.ReactNode> = {
    fiscalYear: <ParamSelect key="fy" field="fiscalYear" label="Fiscal Year" required value={String(params.fiscalYear || "")} onChange={change} error={errors.fiscalYear} allLabel="Select fiscal year" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />,
    quarter: <ParamSelect key="q" field="quarter" label="Quarter" required value={params.quarter} onChange={change} error={errors.quarter} allLabel="Select quarter" options={QUARTERS} />,
    department: <ParamSelect key="d" field="department" label="Department/Office" value={params.department} onChange={change} allLabel="All Departments" options={(options?.departments ?? []).map((d) => ({ value: d, label: d }))} />,
    uacsMajor: <ParamSelect key="u" field="uacsMajor" label="UACS (Major)" value={params.uacsMajor} onChange={change} allLabel="All" options={(options?.uacsMajors ?? []).map((u) => ({ value: u.code, label: u.label }))} />,
    allotmentClass: <ParamSelect key="c" field="allotmentClass" label="Allotment Class" value={params.allotmentClass} onChange={change} allLabel="All" options={CLASS_OPTIONS} />,
  };
  return <>{order.map((f) => fields[f])}</>;
}
