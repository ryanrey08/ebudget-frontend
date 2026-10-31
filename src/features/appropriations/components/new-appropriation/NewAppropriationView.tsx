"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CheckCircle2, Circle, FileText, Info, Pencil, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { applyServerErrors } from "@/components/forms/applyServerErrors";
import { AllotmentClassBadge } from "@/components/shared/AllotmentClassBadge";
import { FISCAL_YEARS } from "@/config/site";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { ALLOTMENT_CLASSES, getAllotmentClass } from "@/lib/constants/allotment-classes";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  useCreateAppropriationMutation,
  useGetAppropriationLookupsQuery,
  useUploadAppropriationDocumentMutation,
} from "../../services/appropriationsApi";
import { APPROPRIATION_SECTIONS, appropriationSchema, type AppropriationValues } from "../../schemas";
import type { AppropriationDocument } from "../../types";
import { AmountInput } from "@/components/forms/AmountInput";
import { DocumentsField } from "@/components/forms/DocumentsField";
import { FormSection } from "@/components/forms/FormSection";

type SectionKey = keyof typeof APPROPRIATION_SECTIONS | "documents";

function defaults(fiscalYear: number, orgCode: string): Partial<AppropriationValues> {
  return {
    fiscalYear,
    title: "",
    type: "GAA",
    orgCode,
    program: "",
    uacsCode: "",
    objectOfExpenditure: "",
    fundSource: "",
    level: "Agency",
    gaaReference: "",
    gaaPart: "",
    effectivityDate: `${fiscalYear}-01-01`,
    expiryDate: `${fiscalYear}-12-31`,
    remarks: "",
  };
}

export function NewAppropriationView() {
  const router = useRouter();
  const notify = useNotify();
  const headerFiscalYear = useFiscalYear();
  const lookups = useGetAppropriationLookupsQuery();
  const [createAppropriation, { isLoading: saving, error: saveError, originalArgs }] = useCreateAppropriationMutation();
  const [documents, setDocuments] = useState<AppropriationDocument[]>([]);
  const [uploadDocument] = useUploadAppropriationDocumentMutation();
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ general: true, budget: true, additional: true, documents: true });
  const [uacsMessage, setUacsMessage] = useState<string | null>(null);
  const [descriptionLocked, setDescriptionLocked] = useState(false);

  const form = useForm<AppropriationValues>({
    resolver: zodResolver(appropriationSchema),
    defaultValues: defaults(headerFiscalYear, ""),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, setValue, getValues, setError, clearErrors, formState } = form;
  const { errors, isDirty } = formState;
  const values = useWatch({ control }) as Partial<AppropriationValues>;

  // Default the office once lookups arrive.
  useEffect(() => {
    if (lookups.data && !getValues("orgCode")) setValue("orgCode", lookups.data.offices[0]?.orgCode ?? "");
  }, [lookups.data, getValues, setValue]);

  const office = lookups.data?.offices.find((o) => o.orgCode === values.orgCode);
  const fund = lookups.data?.fundSources.find((f) => f.code === values.fundSource);
  const classMeta = values.allotmentClass ? getAllotmentClass(values.allotmentClass) : undefined;

  const lookupUacs = () => {
    const code = (getValues("uacsCode") ?? "").trim();
    if (!code) return;
    const match = lookups.data?.uacsCodes.find((u) => u.code === code);
    if (match) {
      setValue("objectOfExpenditure", match.description, { shouldValidate: true, shouldDirty: true });
      if (!getValues("allotmentClass")) setValue("allotmentClass", match.allotmentClass, { shouldValidate: true });
      setDescriptionLocked(true);
      setUacsMessage(null);
      clearErrors("objectOfExpenditure");
    } else {
      setDescriptionLocked(false);
      setUacsMessage("Code not found in the list. Enter the description manually.");
    }
  };

  // Per-section completeness for the Validation panel.
  const sectionStatus = useMemo(() => {
    const result = appropriationSchema.safeParse({ ...values, amount: values.amount });
    const failing = new Set(result.success ? [] : result.error.issues.map((i) => String(i.path[0])));
    return Object.fromEntries(
      Object.entries(APPROPRIATION_SECTIONS).map(([k, fields]) => [k, !fields.some((f) => failing.has(f))]),
    ) as Record<keyof typeof APPROPRIATION_SECTIONS, boolean>;
  }, [values]);
  const allComplete = Object.values(sectionStatus).every(Boolean);

  const openSectionsWithErrors = (errs: FieldErrors<AppropriationValues>) => {
    const keys = Object.keys(errs);
    setOpen((prev) => {
      const next = { ...prev };
      (Object.entries(APPROPRIATION_SECTIONS) as [keyof typeof APPROPRIATION_SECTIONS, readonly string[]][]).forEach(([k, fields]) => {
        if (fields.some((f) => keys.includes(f))) next[k] = true;
      });
      return next;
    });
  };

  const submit = async (data: Partial<AppropriationValues>, draft: boolean) => {
    try {
      const record = await createAppropriation({
        fiscalYear: data.fiscalYear ?? headerFiscalYear,
        title: data.title ?? "",
        type: data.type ?? "GAA",
        orgCode: data.orgCode ?? "",
        program: data.program ?? "",
        uacsCode: data.uacsCode ?? "",
        objectOfExpenditure: data.objectOfExpenditure ?? "",
        fundSource: data.fundSource ?? "",
        allotmentClass: data.allotmentClass ?? "RAOPS",
        amount: Number.isFinite(data.amount) ? Number(data.amount) : 0,
        level: data.level ?? "",
        gaaReference: data.gaaReference ?? "",
        gaaPart: data.gaaPart ?? "",
        effectivityDate: data.effectivityDate ?? "",
        expiryDate: data.expiryDate || undefined,
        remarks: data.remarks ?? "",
        documentIds: documents.map((d) => d.id),
        draft,
      }).unwrap();
      notify(
        "success",
        draft ? "Draft saved" : "Appropriation created",
        `${record.referenceNo} – ${record.title}${draft ? " was saved as a draft." : " was added."}`,
      );
      router.push(ROUTES.appropriations);
    } catch (err) {
      if (applyServerErrors(err, setError)) openSectionsWithErrors(form.formState.errors);
    }
  };

  const onCreate = handleSubmit((data) => submit(data, false), openSectionsWithErrors);

  const onSaveDraft = () => {
    const title = getValues("title")?.trim();
    if (!title) {
      setError("title", { type: "manual", message: "Enter a title to save a draft" });
      setOpen((p) => ({ ...p, general: true }));
      return;
    }
    void submit(getValues(), true);
  };

  const onCancel = () => {
    if ((isDirty || documents.length) && !window.confirm("Discard this appropriation? Your changes will be lost.")) return;
    router.push(ROUTES.appropriations);
  };

  const toggle = (k: SectionKey) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const err = (name: keyof AppropriationValues) => errors[name]?.message;
  const fieldProps = (name: keyof AppropriationValues) => ({
    invalid: !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  if (lookups.isLoading) {
    return (
      <>
        <PageHeader title="New Appropriation" description="Create a new budget appropriation based on the General Appropriations Act (GAA)." extraCrumbs={["New Appropriation"]} />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New Appropriation"
        description="Create a new budget appropriation based on the General Appropriations Act (GAA)."
        extraCrumbs={["New Appropriation"]}
      />

      <form onSubmit={onCreate} noValidate className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-5">
          {saveError && !Object.keys(errors).length && (
            <FormAlert>{getErrorMessage(saveError)}</FormAlert>
          )}

          <FormSection id="section-general" number={1} title="General Information" open={open.general} onToggle={() => toggle("general")}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,15rem)]">
              <FormField label="Fiscal Year" htmlFor="fiscalYear" required error={err("fiscalYear")}>
                <Select
                  id="fiscalYear"
                  options={FISCAL_YEARS.map((fy) => ({ value: String(fy), label: String(fy) }))}
                  {...register("fiscalYear", { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Appropriation Title" htmlFor="title" required error={err("title")}>
                <Input id="title" placeholder="e.g. Salaries and Wages - Permanent" {...fieldProps("title")} {...register("title")} />
              </FormField>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-gray-700">
                  Type<span className="ml-0.5 text-brand-600">*</span>
                </legend>
                <div className="space-y-2">
                  {[
                    { value: "GAA", label: "General Appropriations Act (GAA)" },
                    { value: "Supplemental", label: "Supplemental Appropriation" },
                  ].map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="radio" value={o.value} className="size-4 accent-brand-600" {...register("type")} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Organization/Office" htmlFor="orgCode" required error={err("orgCode")}>
                <Select
                  id="orgCode"
                  placeholder="Select office"
                  options={lookups.data?.offices.map((o) => ({ value: o.orgCode, label: `${o.orgCode} - ${o.name}` })) ?? []}
                  {...fieldProps("orgCode")}
                  {...register("orgCode")}
                />
              </FormField>
              <FormField label="Program/Activity" htmlFor="program" required error={err("program")}>
                <Select
                  id="program"
                  placeholder="Select program/activity"
                  options={lookups.data?.programs.map((p) => ({ value: p, label: p })) ?? []}
                  {...fieldProps("program")}
                  {...register("program")}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection id="section-budget" number={2} title="Budget Details" open={open.budget} onToggle={() => toggle("budget")}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="UACS Code" htmlFor="uacsCode" required error={err("uacsCode") ?? err("objectOfExpenditure")} hint={uacsMessage ?? undefined}>
                <div className="flex">
                  <Input
                    id="uacsCode"
                    inputMode="numeric"
                    placeholder="50201010"
                    className="w-32 rounded-r-none"
                    {...fieldProps("uacsCode")}
                    {...register("uacsCode", {
                      onBlur: lookupUacs,
                      onChange: () => setDescriptionLocked(false),
                    })}
                  />
                  <button
                    type="button"
                    onClick={lookupUacs}
                    className="flex w-10 shrink-0 items-center justify-center border-y border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
                    aria-label="Look up UACS code"
                  >
                    <Search className="size-4" />
                  </button>
                  <label htmlFor="objectOfExpenditure" className="sr-only">
                    Description
                  </label>
                  <input
                    id="objectOfExpenditure"
                    readOnly={descriptionLocked}
                    placeholder="Description"
                    aria-invalid={!!errors.objectOfExpenditure || undefined}
                    className={cn(
                      "h-10 min-w-0 flex-1 rounded-r-lg border border-gray-300 px-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
                      descriptionLocked ? "bg-gray-100 text-gray-600" : "bg-white",
                      errors.objectOfExpenditure && "border-red-400",
                    )}
                    {...register("objectOfExpenditure")}
                  />
                </div>
              </FormField>
              <FormField label="Fund Source" htmlFor="fundSource" required error={err("fundSource")}>
                <Select
                  id="fundSource"
                  placeholder="Select fund source"
                  options={lookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []}
                  {...fieldProps("fundSource")}
                  {...register("fundSource")}
                />
              </FormField>
              <FormField label="Appropriation Amount" htmlFor="amount" required error={err("amount")}>
                <Controller
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <AmountInput
                      id="amount"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={!!errors.amount}
                      describedBy={errors.amount ? "amount-error" : undefined}
                    />
                  )}
                />
              </FormField>
              <div>
                <FormField label="Allotment Class" htmlFor="allotmentClass" required error={err("allotmentClass")}>
                  <Select
                    id="allotmentClass"
                    placeholder="Select allotment class"
                    options={ALLOTMENT_CLASSES.map((c) => ({ value: c.code, label: `${c.code} - ${c.expenseClass}` }))}
                    {...fieldProps("allotmentClass")}
                    {...register("allotmentClass")}
                  />
                </FormField>
                {classMeta && (
                  <div className="mt-2 flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
                    <Info className="mt-0.5 size-4 shrink-0 fill-blue-600 text-white" aria-hidden />
                    <div>
                      <p className="font-semibold">{classMeta.code}</p>
                      <p>{classMeta.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection id="section-additional" number={3} title="Additional Details" open={open.additional} onToggle={() => toggle("additional")}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField label="Appropriation Level" htmlFor="level" required error={err("level")}>
                <Select
                  id="level"
                  placeholder="Select level"
                  options={lookups.data?.levels.map((l) => ({ value: l, label: l })) ?? []}
                  {...fieldProps("level")}
                  {...register("level")}
                />
              </FormField>
              <FormField label="GAA Reference" htmlFor="gaaReference" required error={err("gaaReference")}>
                <Input id="gaaReference" placeholder="e.g. GAA FY 2026 - Page 125" {...fieldProps("gaaReference")} {...register("gaaReference")} />
              </FormField>
              <FormField label="GAA Part/Agency" htmlFor="gaaPart" error={err("gaaPart")}>
                <Input id="gaaPart" placeholder="e.g. State Universities and Colleges (SUCs)" {...register("gaaPart")} />
              </FormField>
              <FormField label="Effectivity Date" htmlFor="effectivityDate" required error={err("effectivityDate")}>
                <Input id="effectivityDate" type="date" {...fieldProps("effectivityDate")} {...register("effectivityDate")} />
              </FormField>
              <FormField label="Expiry Date" htmlFor="expiryDate" error={err("expiryDate")}>
                <Input id="expiryDate" type="date" {...fieldProps("expiryDate")} {...register("expiryDate")} />
              </FormField>
              <FormField label="Remarks" htmlFor="remarks" error={err("remarks")} className="md:row-span-2">
                <Textarea id="remarks" rows={3} maxLength={500} placeholder="Enter remarks (optional)…" {...register("remarks")} />
                <p className="text-right text-xs text-gray-500">{(values.remarks ?? "").length}/500</p>
              </FormField>
            </div>
          </FormSection>

          <FormSection id="section-documents" number={4} title="Supporting Documents" open={open.documents} onToggle={() => toggle("documents")}>
            <DocumentsField documents={documents} onChange={setDocuments} upload={(file) => uploadDocument(file).unwrap()} />
          </FormSection>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24" aria-label="Appropriation summary and validation">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Appropriation Summary</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen((p) => ({ ...p, general: true }));
                  document.getElementById("section-general")?.scrollIntoView({ behavior: "smooth" });
                  setTimeout(() => document.getElementById("title")?.focus(), 300);
                }}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            </div>
            <dl className="mt-4 divide-y divide-gray-100 text-sm">
              <SummaryRow label="Fiscal Year" value={values.fiscalYear} />
              <SummaryRow
                label="Organization/Office"
                value={office ? <>{office.orgCode}<span className="block text-gray-500">{office.name}</span></> : undefined}
              />
              <SummaryRow label="Program/Activity" value={values.program} />
              <SummaryRow label="UACS Code" value={values.uacsCode} />
              <SummaryRow label="Description" value={values.objectOfExpenditure} />
              <SummaryRow label="Fund Source" value={fund ? `${fund.code} - ${fund.name}` : undefined} />
              <SummaryRow label="Allotment Class" value={values.allotmentClass ? <AllotmentClassBadge code={values.allotmentClass} /> : undefined} />
              <SummaryRow
                label="Appropriation Amount"
                value={values.amount && Number.isFinite(values.amount) ? <span className="text-base font-bold">{formatCurrency(values.amount)}</span> : undefined}
              />
              <SummaryRow label="Effectivity Date" value={values.effectivityDate ? formatDate(values.effectivityDate) : undefined} />
              <SummaryRow label="Expiry Date" value={values.expiryDate ? formatDate(values.expiryDate) : undefined} />
              <SummaryRow label="GAA Reference" value={values.gaaReference} />
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-gray-900">Validation</h2>
            <div
              className={cn(
                "mt-4 flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium",
                allComplete ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800",
              )}
              role="status"
            >
              {allComplete ? <CheckCircle2 className="size-5 fill-green-600 text-white" aria-hidden /> : <Info className="size-5" aria-hidden />}
              {allComplete ? "All required fields are completed." : "Complete the required fields to create the appropriation."}
            </div>
            <ul className="mt-4 space-y-3 text-sm text-gray-700">
              <ChecklistItem done={sectionStatus.general} label="General Information" />
              <ChecklistItem done={sectionStatus.budget} label="Budget Details" />
              <ChecklistItem done={sectionStatus.additional} label="Additional Details" />
              <ChecklistItem done={documents.length > 0} label="Supporting Documents" optional />
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={onCancel} disabled={saving}>
              <X className="size-4" /> Cancel
            </Button>
            <Button variant="outline" size="lg" onClick={onSaveDraft} loading={saving && originalArgs?.draft} disabled={saving}>
              {!(saving && originalArgs?.draft) && <FileText className="size-4" />} Save as Draft
            </Button>
            <Button type="submit" size="lg" className="col-span-2" loading={saving && !originalArgs?.draft} disabled={saving}>
              {!(saving && !originalArgs?.draft) && <Check className="size-4" />} Create Appropriation
            </Button>
          </div>
        </aside>
      </form>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-2.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="break-words text-gray-900">{value || value === 0 ? value : <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}

function ChecklistItem({ done, label, optional }: { done: boolean; label: string; optional?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="size-5 fill-green-600 text-white" aria-label="Complete" />
      ) : (
        <Circle className="size-5 text-gray-300" aria-label={optional ? "Optional" : "Incomplete"} />
      )}
      {label}
      {optional && !done && <span className="text-xs text-gray-400">(optional)</span>}
    </li>
  );
}
