"use client";

import { FISCAL_YEARS } from "@/config/site";
import { ParamSelect, QUARTERS, type QproField } from "../qpro/QproParamFields";
import type { Quarter } from "../qpro/types";
import type { SabudbtrFilterLabels } from "./document";
import type { SabudbtrParams, SabudbtrReport } from "./types";

export type SabudbtrField = keyof SabudbtrParams;

export const emptySabudbtrParams = (fiscalYear: number): SabudbtrParams => ({ fiscalYear, quarter: "Q1", department: "", fund: "", uacsMajor: "" });

export function validateSabudbtrParams(p: SabudbtrParams): Partial<Record<SabudbtrField, string>> {
  const errors: Partial<Record<SabudbtrField, string>> = {};
  if (!p.fiscalYear) errors.fiscalYear = "Select the fiscal year";
  if (!p.quarter) errors.quarter = "Select the quarter";
  return errors;
}

/** Applies one field change; a UACS code that belongs to another fund is cleared when the fund changes. */
export function changeSabudbtrParam(p: SabudbtrParams, field: SabudbtrField, value: string, options?: SabudbtrReport["options"]): SabudbtrParams {
  if (field === "fiscalYear") return { ...p, fiscalYear: Number(value) || 0 };
  if (field === "quarter") return { ...p, quarter: value as Quarter | "" };
  if (field === "fund") {
    const uacsFund = options?.uacsMajors.find((u) => u.code === p.uacsMajor)?.fund;
    return { ...p, fund: value, uacsMajor: value && uacsFund && uacsFund !== value ? "" : p.uacsMajor };
  }
  return { ...p, [field]: value };
}

/** Display labels for the current filters ("All …" when empty), as in the report's parameter block. */
export function sabudbtrFilterLabels(p: SabudbtrParams, options?: SabudbtrReport["options"]): SabudbtrFilterLabels {
  const account = options?.uacsMajors.find((u) => u.code === p.uacsMajor);
  return {
    department: p.department || "All Departments",
    fund: p.fund || "All Funds",
    uacsMajor: account ? `${account.code} – ${account.label}` : p.uacsMajor || "All",
  };
}

/** Report parameter selects shared by the BFARS 11 page and the report generator. */
export function SabudbtrFields({
  params,
  onChange,
  options,
  errors,
}: {
  params: SabudbtrParams;
  onChange: (field: SabudbtrField, value: string) => void;
  options?: SabudbtrReport["options"];
  errors: Partial<Record<SabudbtrField, string>>;
}) {
  const change = (f: QproField, v: string) => onChange(f as SabudbtrField, v);
  const accounts = (options?.uacsMajors ?? []).filter((u) => !params.fund || u.fund === params.fund);
  return (
    <>
      <ParamSelect field="fiscalYear" label="Fiscal Year" required value={String(params.fiscalYear || "")} onChange={change} error={errors.fiscalYear} allLabel="Select fiscal year" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />
      <ParamSelect field="quarter" label="Quarter" required value={params.quarter} onChange={change} error={errors.quarter} allLabel="Select quarter" options={QUARTERS} />
      <ParamSelect field="department" label="Department/Office" value={params.department} onChange={change} allLabel="All Departments" options={(options?.departments ?? []).map((d) => ({ value: d, label: d }))} />
      <ParamSelect field={"fund" as QproField} label="Trust Receipt Fund" value={params.fund} onChange={change} allLabel="All Funds" options={(options?.funds ?? []).map((f) => ({ value: f, label: f }))} />
      <ParamSelect field="uacsMajor" label="UACS (Major)" value={params.uacsMajor} onChange={change} allLabel="All" options={accounts.map((u) => ({ value: u.code, label: `${u.code} – ${u.label}` }))} />
    </>
  );
}
