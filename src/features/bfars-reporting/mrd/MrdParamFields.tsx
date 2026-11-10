"use client";

import { FISCAL_YEARS } from "@/config/site";
import { CLASS_OPTIONS, ParamSelect, type QproField } from "../qpro/QproParamFields";
import { MONTHS, type MrdFilterLabels } from "./document";
import type { MrdParams, MrdReport } from "./types";

export type MrdField = keyof MrdParams;

const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

export const emptyMrdParams = (fiscalYear: number): MrdParams => ({ fiscalYear, month: 3, department: "", allotmentClass: "", uacsMajor: "" });

export function validateMrdParams(p: MrdParams): Partial<Record<MrdField, string>> {
  const errors: Partial<Record<MrdField, string>> = {};
  if (!p.fiscalYear) errors.fiscalYear = "Select the fiscal year";
  if (!p.month) errors.month = "Select the month";
  else if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) errors.month = "Select a valid month";
  return errors;
}

/** Applies one field change (fiscal year and month are numbers, the rest strings). */
export function changeMrdParam(p: MrdParams, field: MrdField, value: string): MrdParams {
  if (field === "fiscalYear" || field === "month") return { ...p, [field]: Number(value) || 0 };
  return { ...p, [field]: value };
}

/** Display labels for the current filters ("All …" when empty). */
export function mrdFilterLabels(p: MrdParams, options?: MrdReport["options"]): MrdFilterLabels {
  return {
    department: p.department || "All Departments",
    allotmentClass: p.allotmentClass || "All",
    uacsMajor: options?.uacsMajors.find((u) => u.code === p.uacsMajor)?.label ?? "All",
  };
}

/** Report parameter selects shared by the BFARS 9 page and the report generator. */
export function MrdFields({
  params,
  onChange,
  options,
  errors,
  fields,
}: {
  params: MrdParams;
  onChange: (field: MrdField, value: string) => void;
  options?: MrdReport["options"];
  errors: Partial<Record<MrdField, string>>;
  fields: MrdField[];
}) {
  const change = (f: QproField, v: string) => onChange(f as MrdField, v);
  const all: Record<MrdField, React.ReactNode> = {
    fiscalYear: <ParamSelect key="fy" field="fiscalYear" label="Fiscal Year" required value={String(params.fiscalYear || "")} onChange={change} error={errors.fiscalYear} allLabel="Select fiscal year" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />,
    month: <ParamSelect key="m" field={"month" as QproField} label="Month" required value={params.month ? String(params.month) : ""} onChange={change} error={errors.month} allLabel="Select month" options={MONTH_OPTIONS} />,
    department: <ParamSelect key="d" field="department" label="Department/Office" value={params.department} onChange={change} allLabel="All Departments" options={(options?.departments ?? []).map((d) => ({ value: d, label: d }))} />,
    allotmentClass: <ParamSelect key="c" field="allotmentClass" label="Allotment Class" value={params.allotmentClass} onChange={change} allLabel="All" options={CLASS_OPTIONS} />,
    uacsMajor: <ParamSelect key="u" field="uacsMajor" label="UACS (Major)" value={params.uacsMajor} onChange={change} allLabel="All" options={(options?.uacsMajors ?? []).map((u) => ({ value: u.code, label: u.label }))} />,
  };
  return <>{fields.map((f) => all[f])}</>;
}
