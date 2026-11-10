"use client";

import { FISCAL_YEARS } from "@/config/site";
import { ParamSelect, QUARTERS, type QproField } from "../qpro/QproParamFields";
import type { Quarter } from "../qpro/types";
import { QRROR_CLASSES, type QrrorFilterLabels } from "./document";
import type { QrrorParams, QrrorReport } from "./types";

export type QrrorField = keyof QrrorParams;

const CLASS_OPTIONS = QRROR_CLASSES.map((c) => ({ value: c.code, label: c.name }));

export const emptyQrrorParams = (fiscalYear: number): QrrorParams => ({ fiscalYear, quarter: "Q1", department: "", classification: "", uacsMajor: "" });

export function validateQrrorParams(p: QrrorParams): Partial<Record<QrrorField, string>> {
  const errors: Partial<Record<QrrorField, string>> = {};
  if (!p.fiscalYear) errors.fiscalYear = "Select the fiscal year";
  if (!p.quarter) errors.quarter = "Select the quarter";
  return errors;
}

/** Applies one field change; a UACS account outside a newly selected classification is cleared. */
export function changeQrrorParam(p: QrrorParams, field: QrrorField, value: string): QrrorParams {
  if (field === "fiscalYear") return { ...p, fiscalYear: Number(value) || 0 };
  if (field === "quarter") return { ...p, quarter: value as Quarter | "" };
  if (field === "classification") return { ...p, classification: value, uacsMajor: value && !p.uacsMajor.startsWith(value) ? "" : p.uacsMajor };
  return { ...p, [field]: value };
}

/** Display labels for the current filters ("All …" when empty). */
export function qrrorFilterLabels(p: QrrorParams, options?: QrrorReport["options"]): QrrorFilterLabels {
  const account = options?.uacsMajors.find((u) => u.code === p.uacsMajor);
  return {
    department: p.department || "All Departments",
    classification: QRROR_CLASSES.find((c) => c.code === p.classification)?.name ?? "All",
    uacsMajor: account ? `${account.code} – ${account.label}` : "All",
  };
}

/** Report parameter selects shared by the BFARS 10 page and the report generator. */
export function QrrorFields({
  params,
  onChange,
  options,
  errors,
}: {
  params: QrrorParams;
  onChange: (field: QrrorField, value: string) => void;
  options?: QrrorReport["options"];
  errors: Partial<Record<QrrorField, string>>;
}) {
  const change = (f: QproField, v: string) => onChange(f as QrrorField, v);
  const accounts = (options?.uacsMajors ?? []).filter((u) => !params.classification || u.classification === params.classification);
  return (
    <>
      <ParamSelect field="fiscalYear" label="Fiscal Year" required value={String(params.fiscalYear || "")} onChange={change} error={errors.fiscalYear} allLabel="Select fiscal year" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: String(y) }))} />
      <ParamSelect field="quarter" label="Quarter" required value={params.quarter} onChange={change} error={errors.quarter} allLabel="Select quarter" options={QUARTERS} />
      <ParamSelect field="department" label="Department/Office" value={params.department} onChange={change} allLabel="All Departments" options={(options?.departments ?? []).map((d) => ({ value: d, label: d }))} />
      <ParamSelect field={"classification" as QproField} label="Revenue Classification" value={params.classification} onChange={change} allLabel="All" options={CLASS_OPTIONS} />
      <ParamSelect field="uacsMajor" label="UACS (Major)" value={params.uacsMajor} onChange={change} allLabel="All" options={accounts.map((u) => ({ value: u.code, label: `${u.code} – ${u.label}` }))} />
    </>
  );
}
