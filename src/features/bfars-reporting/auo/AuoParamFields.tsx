"use client";

import { FISCAL_YEARS } from "@/config/site";
import { CLASS_OPTIONS, ParamSelect, type QproField } from "../qpro/QproParamFields";
import { lasaDate } from "../lasa/document";
import type { AuoFilterLabels } from "./document";
import type { AuoParams, AuoReport } from "./types";

export type AuoField = keyof AuoParams;

/** Month-end dates of the fiscal year, the "As of Date" choices. */
export const asOfOptions = (fiscalYear: number) =>
  Array.from({ length: 12 }, (_, m) => {
    const iso = `${fiscalYear}-${String(m + 1).padStart(2, "0")}-${String(new Date(Date.UTC(fiscalYear, m + 1, 0)).getUTCDate()).padStart(2, "0")}`;
    return { value: iso, label: lasaDate(iso) };
  });

export const emptyAuoParams = (fiscalYear: number): AuoParams => ({ fiscalYear, asOf: `${fiscalYear}-03-31`, department: "", allotmentClass: "", uacsMajor: "" });

export function validateAuoParams(p: AuoParams): Partial<Record<AuoField, string>> {
  const errors: Partial<Record<AuoField, string>> = {};
  if (!p.fiscalYear) errors.fiscalYear = "Select the fiscal year";
  if (!p.asOf) errors.asOf = "Select the as-of date";
  else if (p.fiscalYear && !p.asOf.startsWith(`${p.fiscalYear}-`)) errors.asOf = "The as-of date must fall within the fiscal year";
  return errors;
}

/** Applies one field change; a new fiscal year keeps the same month-end for the as-of date. */
export function changeAuoParam(p: AuoParams, field: AuoField, value: string): AuoParams {
  if (field !== "fiscalYear") return { ...p, [field]: value };
  const fiscalYear = Number(value) || 0;
  return { ...p, fiscalYear, asOf: fiscalYear && p.asOf ? asOfOptions(fiscalYear)[Number(p.asOf.slice(5, 7)) - 1].value : p.asOf };
}

/** Display labels for the current filters ("All …" when empty). */
export function auoFilterLabels(p: AuoParams, options?: AuoReport["options"]): AuoFilterLabels {
  return {
    department: p.department || "All Departments",
    allotmentClass: p.allotmentClass || "All",
    uacsMajor: options?.uacsMajors.find((u) => u.code === p.uacsMajor)?.label ?? "All",
  };
}

/** Report parameter selects shared by the BFARS 8 page and the report generator. */
export function AuoFields({
  params,
  onChange,
  options,
  errors,
  fields,
}: {
  params: AuoParams;
  onChange: (field: AuoField, value: string) => void;
  options?: AuoReport["options"];
  errors: Partial<Record<AuoField, string>>;
  fields: AuoField[];
}) {
  const change = (f: QproField, v: string) => onChange(f as AuoField, v);
  const all: Record<AuoField, React.ReactNode> = {
    fiscalYear: <ParamSelect key="fy" field="fiscalYear" label="Fiscal Year" required value={String(params.fiscalYear || "")} onChange={change} error={errors.fiscalYear} allLabel="Select fiscal year" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />,
    asOf: <ParamSelect key="asof" field={"asOf" as QproField} label="As of Date" required value={params.asOf} onChange={change} error={errors.asOf} allLabel="Select date" options={params.fiscalYear ? asOfOptions(params.fiscalYear) : []} />,
    department: <ParamSelect key="d" field="department" label="Department/Office" value={params.department} onChange={change} allLabel="All Departments" options={(options?.departments ?? []).map((d) => ({ value: d, label: d }))} />,
    allotmentClass: <ParamSelect key="c" field="allotmentClass" label="Allotment Class" value={params.allotmentClass} onChange={change} allLabel="All" options={CLASS_OPTIONS} />,
    uacsMajor: <ParamSelect key="u" field="uacsMajor" label="UACS (Major)" value={params.uacsMajor} onChange={change} allLabel="All" options={(options?.uacsMajors ?? []).map((u) => ({ value: u.code, label: u.label }))} />,
  };
  return <>{fields.map((f) => all[f])}</>;
}
