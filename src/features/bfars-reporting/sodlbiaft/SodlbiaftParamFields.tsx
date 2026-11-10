"use client";

import { FISCAL_YEARS } from "@/config/site";
import { ParamSelect, QUARTERS, type QproField } from "../qpro/QproParamFields";
import type { SodlbiaftFilterLabels } from "./document";
import type { SodlbiaftParams, SodlbiaftReport } from "./types";

export type SodlbiaftField = keyof SodlbiaftParams;

export const emptySodlbiaftParams = (fiscalYear: number): SodlbiaftParams => ({ fiscalYear, quarter: "Q1", office: "", sourceAgency: "", program: "" });

export function validateSodlbiaftParams(p: SodlbiaftParams): Partial<Record<SodlbiaftField, string>> {
  const errors: Partial<Record<SodlbiaftField, string>> = {};
  if (!p.fiscalYear) errors.fiscalYear = "Select the fiscal year";
  if (!p.quarter) errors.quarter = "Select the quarter";
  return errors;
}

/** Display labels for the current filters ("All …" when empty), as on the report header. */
export function sodlbiaftFilterLabels(p: SodlbiaftParams): SodlbiaftFilterLabels {
  return {
    office: p.office || "All Offices",
    sourceAgency: p.sourceAgency || "All Agencies",
    program: p.program || "All Programs/Projects",
  };
}

/** Report parameter selects shared by the BFARS 5 page and the report generator. */
export function SodlbiaftFields({
  params,
  onChange,
  options,
  errors,
}: {
  params: SodlbiaftParams;
  onChange: (field: SodlbiaftField, value: string) => void;
  options?: SodlbiaftReport["options"];
  errors: Partial<Record<SodlbiaftField, string>>;
}) {
  // ParamSelect only uses the field name for ids and the change callback.
  const change = (f: QproField, v: string) => onChange(f as unknown as SodlbiaftField, v);
  const field = (f: SodlbiaftField) => f as unknown as QproField;
  return (
    <>
      <ParamSelect field={field("fiscalYear")} label="Fiscal Year" required value={String(params.fiscalYear || "")} onChange={change} error={errors.fiscalYear} allLabel="Select fiscal year" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />
      <ParamSelect field={field("quarter")} label="Quarter" required value={params.quarter} onChange={change} error={errors.quarter} allLabel="Select quarter" options={QUARTERS} />
      <ParamSelect field={field("office")} label="Implementing Office" value={params.office} onChange={change} allLabel="All Offices" options={(options?.offices ?? []).map((o) => ({ value: o, label: o }))} />
      <ParamSelect field={field("sourceAgency")} label="Source Agency" value={params.sourceAgency} onChange={change} allLabel="All Agencies" options={(options?.sourceAgencies ?? []).map((a) => ({ value: a.code, label: a.code === "Others" ? "Others (Various Agencies)" : `${a.code} – ${a.name}` }))} />
      <ParamSelect field={field("program")} label="Program/Project" value={params.program} onChange={change} allLabel="All" options={(options?.programs ?? []).map((p) => ({ value: p, label: p }))} />
    </>
  );
}
