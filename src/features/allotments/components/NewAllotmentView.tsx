"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CheckCircle2, Circle, Info, Pencil, Save, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { AmountInput } from "@/components/forms/AmountInput";
import { DocumentsField } from "@/components/forms/DocumentsField";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { FormSection } from "@/components/forms/FormSection";
import { applyServerErrors } from "@/components/forms/applyServerErrors";
import { AllotmentClassBadge } from "@/components/shared/AllotmentClassBadge";
import { FISCAL_YEARS } from "@/config/site";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { ALLOTMENT_CLASSES, getAllotmentClass } from "@/lib/constants/allotment-classes";
import { toOptions } from "@/lib/constants/options";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  useGetAppropriationLookupsQuery,
  useGetAppropriationsQuery,
} from "@/features/appropriations/services/appropriationsApi";
import {
  useCreateAllotmentMutation,
  useGetNextAllotmentNumberQuery,
  useUploadAllotmentDocumentMutation,
} from "../services/allotmentsApi";
import { ALLOTMENT_SECTIONS, allotmentFormSchema, type AllotmentFormValues } from "../schemas";
import { TRANCHE_TYPES, WORKFLOW_STEPS, type AllotmentDocument } from "../types";
import { ApprovalStepper } from "./ApprovalStepper";

type SectionKey = "appropriation" | "details" | "documents" | "workflow";

export function NewAllotmentView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const headerFy = useFiscalYear();
  const lookups = useGetAppropriationLookupsQuery();
  const [documents, setDocuments] = useState<AllotmentDocument[]>([]);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ appropriation: true, details: true, documents: true, workflow: true });
  const [uploadDocument] = useUploadAllotmentDocumentMutation();
  const [createAllotment, { isLoading: saving, error: saveError, originalArgs }] = useCreateAllotmentMutation();

  // The amount limit depends on the selected appropriation, so the resolver reads the latest schema.
  const schemaRef = useRef(allotmentFormSchema(null));
  const form = useForm<AllotmentFormValues>({
    resolver: (values, context, options) => zodResolver(schemaRef.current)(values, context, options),
    defaultValues: {
      fiscalYear: headerFy,
      appropriationRef: searchParams.get("appropriation") ?? "",
      fundSource: "",
      tranche: "1st Tranche",
      releaseDate: new Date().toISOString().slice(0, 10),
      purpose: "",
    },
    mode: "onTouched",
  });
  const { control, register, setValue, getValues, setError, handleSubmit, formState } = form;
  const values = useWatch({ control }) as Partial<AllotmentFormValues>;
  const fiscalYear = values.fiscalYear ?? headerFy;

  const appropriations = useGetAppropriationsQuery({ fiscalYear, pageSize: 100 });
  const nextNumber = useGetNextAllotmentNumberQuery({ fiscalYear });
  const options = useMemo(
    () => appropriations.data?.items.filter((a) => a.status !== "Draft") ?? [],
    [appropriations.data],
  );
  const app = options.find((a) => a.referenceNo === values.appropriationRef);
  const remaining = app ? app.amount - app.allotted : null;
  const schema = useMemo(() => allotmentFormSchema(remaining), [remaining]);
  schemaRef.current = schema;

  // Pre-fill class and fund source from the chosen appropriation.
  useEffect(() => {
    if (!app) return;
    setValue("allotmentClass", app.allotmentClass, { shouldValidate: formState.isSubmitted });
    setValue("fundSource", app.fundSource, { shouldValidate: formState.isSubmitted });
    if (!getValues("purpose")) setValue("purpose", `Release of allotment for ${app.title} for FY ${app.fiscalYear}.`);
  }, [app, setValue, getValues, formState.isSubmitted]);

  const fundName = (code?: string) => lookups.data?.fundSources.find((f) => f.code === code)?.name ?? "";
  const classMeta = values.allotmentClass ? getAllotmentClass(values.allotmentClass) : undefined;

  const sectionDone = useMemo(() => {
    const result = schema.safeParse(values);
    const failing = new Set(result.success ? [] : result.error.issues.map((i) => String(i.path[0])));
    return {
      appropriation: !ALLOTMENT_SECTIONS.appropriation.some((f) => failing.has(f)),
      details: !ALLOTMENT_SECTIONS.details.some((f) => failing.has(f)),
    };
  }, [schema, values]);
  const allComplete = sectionDone.appropriation && sectionDone.details;

  const openErrorSections = (errs: FieldErrors<AllotmentFormValues>) => {
    const keys = Object.keys(errs);
    setOpen((p) => ({
      ...p,
      appropriation: p.appropriation || ALLOTMENT_SECTIONS.appropriation.some((f) => keys.includes(f)),
      details: p.details || ALLOTMENT_SECTIONS.details.some((f) => keys.includes(f)),
    }));
  };

  const submit = async (data: Partial<AllotmentFormValues>, draft: boolean) => {
    try {
      const record = await createAllotment({
        fiscalYear: data.fiscalYear ?? headerFy,
        appropriationRef: data.appropriationRef ?? "",
        allotmentClass: data.allotmentClass ?? "RAOPS",
        fundSource: data.fundSource ?? "",
        amount: Number.isFinite(data.amount) ? Number(data.amount) : 0,
        tranche: data.tranche ?? "1st Tranche",
        releaseAmount: Number.isFinite(data.releaseAmount) ? Number(data.releaseAmount) : 0,
        releaseDate: data.releaseDate ?? "",
        purpose: data.purpose ?? "",
        documentIds: documents.map((d) => d.id),
        draft,
      }).unwrap();
      notify("success", draft ? "Draft saved" : "Submitted for approval", `${record.allotmentNo} ${draft ? "was saved as a draft." : "is now with the Budget Head for review."}`);
      router.push(draft ? ROUTES.allotments : ROUTES.allotment(record.id));
    } catch (err) {
      applyServerErrors(err, setError);
    }
  };

  const onSubmit = handleSubmit((data) => submit(data, false), openErrorSections);

  const onSaveDraft = () => {
    if (!getValues("appropriationRef")) {
      setError("appropriationRef", { message: "Select an appropriation to save a draft" });
      setOpen((p) => ({ ...p, appropriation: true }));
      return;
    }
    void submit(getValues(), true);
  };

  const onCancel = () => {
    if ((formState.isDirty || documents.length) && !window.confirm("Discard this allotment? Your changes will be lost.")) return;
    router.push(ROUTES.allotments);
  };

  const errors = formState.errors;
  const err = (n: keyof AllotmentFormValues) => errors[n]?.message;
  const invalid = (n: keyof AllotmentFormValues) => ({ invalid: !!errors[n], "aria-describedby": errors[n] ? `${n}-error` : undefined });
  const toggle = (k: SectionKey) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const readOnly = "bg-gray-100 text-gray-700";

  const previewSteps = WORKFLOW_STEPS.map((key, i) => ({ key, status: i === 0 ? ("current" as const) : ("pending" as const) }));

  return (
    <>
      <PageHeader
        title="New Allotment"
        description="Create a new allotment and tranche release based on an approved appropriation."
        extraCrumbs={["New Allotment"]}
      />
      {appropriations.isLoading || lookups.isLoading ? (
        <Skeleton className="h-[600px] w-full rounded-xl" />
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-w-0 space-y-5">
            {saveError && !Object.keys(errors).length && <FormAlert>{getErrorMessage(saveError)}</FormAlert>}

            <FormSection id="section-appropriation" number={1} title="Appropriation Information" open={open.appropriation} onToggle={() => toggle("appropriation")}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1fr)]">
                <FormField label="Fiscal Year" htmlFor="fiscalYear" required>
                  <Select id="fiscalYear" options={FISCAL_YEARS.map((fy) => ({ value: String(fy), label: String(fy) }))} {...register("fiscalYear", { valueAsNumber: true, onChange: () => setValue("appropriationRef", "") })} />
                </FormField>
                <FormField label="Appropriation No." htmlFor="appropriationRef" required error={err("appropriationRef")}>
                  <Select
                    id="appropriationRef"
                    placeholder="Select appropriation"
                    options={options.map((a) => ({ value: a.referenceNo, label: `${a.referenceNo} · ${a.title}` }))}
                    {...invalid("appropriationRef")}
                    {...register("appropriationRef")}
                  />
                </FormField>
                <FormField label="Appropriation Title" htmlFor="appTitle">
                  <Input id="appTitle" readOnly value={app?.title ?? ""} placeholder="—" className={readOnly} />
                </FormField>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField label="Organization/Office" htmlFor="appOffice">
                  <Input id="appOffice" readOnly value={app ? `${app.orgCode} - ${app.office}` : ""} placeholder="—" className={readOnly} />
                </FormField>
                <FormField label="Program/Activity" htmlFor="appProgram">
                  <Input id="appProgram" readOnly value={app?.program ?? ""} placeholder="—" className={readOnly} />
                </FormField>
                <FormField label="UACS Code" htmlFor="appUacs">
                  <Input id="appUacs" readOnly value={app ? `${app.uacsCode} – ${app.objectOfExpenditure}` : ""} placeholder="—" className={readOnly} />
                </FormField>
                <FormField label="Remaining Unallotted Balance" htmlFor="appRemaining">
                  <Input id="appRemaining" readOnly value={remaining !== null ? formatCurrency(remaining) : ""} placeholder="—" className={cn(readOnly, "font-medium tabular-nums")} />
                </FormField>
              </div>
            </FormSection>

            <FormSection id="section-details" number={2} title="Allotment Details" open={open.details} onToggle={() => toggle("details")}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField label="Allotment No." htmlFor="allotmentNo" hint="Assigned when saved">
                  <Input id="allotmentNo" readOnly value={nextNumber.data?.allotmentNo ?? ""} className={readOnly} />
                </FormField>
                <div>
                  <FormField label="Allotment Class" htmlFor="allotmentClass" required error={err("allotmentClass")}>
                    <Select id="allotmentClass" placeholder="Select class" options={ALLOTMENT_CLASSES.map((c) => ({ value: c.code, label: `${c.code} - ${c.expenseClass}` }))} {...invalid("allotmentClass")} {...register("allotmentClass")} />
                  </FormField>
                </div>
                <FormField label="Fund Source" htmlFor="fundSource" required error={err("fundSource")}>
                  <Select id="fundSource" placeholder="Select fund source" options={lookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []} {...invalid("fundSource")} {...register("fundSource")} />
                </FormField>
              </div>
              {classMeta && (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
                  <Info className="mt-0.5 size-4 shrink-0 fill-blue-600 text-white" aria-hidden />
                  <span><strong>{classMeta.code}</strong> – {classMeta.name}</span>
                </p>
              )}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                <FormField label="Allotment Amount" htmlFor="amount" required error={err("amount")}>
                  <Controller control={control} name="amount" render={({ field }) => <AmountInput id="amount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.amount} describedBy={errors.amount ? "amount-error" : undefined} />} />
                </FormField>
                <FormField label="Tranche Type" htmlFor="tranche" required>
                  <Select id="tranche" options={toOptions(TRANCHE_TYPES)} {...register("tranche")} />
                </FormField>
                <FormField label="Release Amount" htmlFor="releaseAmount" required error={err("releaseAmount")}>
                  <Controller control={control} name="releaseAmount" render={({ field }) => <AmountInput id="releaseAmount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.releaseAmount} describedBy={errors.releaseAmount ? "releaseAmount-error" : undefined} />} />
                </FormField>
                <FormField label="Release Date" htmlFor="releaseDate" required error={err("releaseDate")}>
                  <Input id="releaseDate" type="date" {...invalid("releaseDate")} {...register("releaseDate")} />
                </FormField>
              </div>
              <FormField label="Purpose/Particulars" htmlFor="purpose" required error={err("purpose")} className="mt-4">
                <Textarea id="purpose" rows={3} maxLength={500} {...invalid("purpose")} {...register("purpose")} />
                <p className="text-right text-xs text-gray-500">{(values.purpose ?? "").length}/500</p>
              </FormField>
            </FormSection>

            <FormSection id="section-documents" number={3} title="Supporting Documents" open={open.documents} onToggle={() => toggle("documents")}>
              <DocumentsField documents={documents} onChange={setDocuments} upload={(file) => uploadDocument(file).unwrap()} />
            </FormSection>

            <FormSection id="section-workflow" number={4} title="Approval Workflow" open={open.workflow} onToggle={() => toggle("workflow")}>
              <ApprovalStepper steps={previewSteps} />
              <p className="mt-4 text-xs text-gray-500">
                After you submit, the allotment goes to the Budget Head, then the Accountant, then the Head of Agency for certification before release.
              </p>
            </FormSection>
          </div>

          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24" aria-label="Allotment summary and validation">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Appropriation Details</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen((p) => ({ ...p, appropriation: true }));
                    document.getElementById("section-appropriation")?.scrollIntoView({ behavior: "smooth" });
                    setTimeout(() => document.getElementById("appropriationRef")?.focus(), 300);
                  }}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </div>
              <dl className="mt-3 divide-y divide-gray-100 text-sm">
                <Row label="Appropriation No." value={app?.referenceNo} />
                <Row label="Fiscal Year" value={app?.fiscalYear} />
                <Row label="Title" value={app?.title} />
                <Row label="Organization/Office" value={app ? <>{app.orgCode}<span className="block text-gray-500">{app.office}</span></> : undefined} />
                <Row label="Program/Activity" value={app?.program} />
                <Row label="UACS Code" value={app?.uacsCode} />
                <Row label="Description" value={app?.objectOfExpenditure} />
                <Row label="Fund Source" value={app ? `${app.fundSource} - ${fundName(app.fundSource)}` : undefined} />
                <Row label="Appropriation Amount" value={app ? formatCurrency(app.amount) : undefined} />
                <Row label="Allotted Amount" value={app ? formatCurrency(app.allotted) : undefined} />
                <Row label="Unallotted Balance" value={remaining !== null ? <span className="font-semibold">{formatCurrency(remaining)}</span> : undefined} />
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold text-gray-900">Allotment Summary</h2>
              <dl className="mt-3 divide-y divide-gray-100 text-sm">
                <Row label="Allotment No." value={nextNumber.data?.allotmentNo} />
                <Row label="Allotment Class" value={values.allotmentClass ? <AllotmentClassBadge code={values.allotmentClass} /> : undefined} />
                <Row label="Allotment Amount" value={values.amount && Number.isFinite(values.amount) ? <span className="font-semibold">{formatCurrency(values.amount)}</span> : undefined} />
                <Row label="Tranche" value={values.tranche} />
                <Row label="Release Amount" value={values.releaseAmount && Number.isFinite(values.releaseAmount) ? formatCurrency(values.releaseAmount) : undefined} />
                <Row label="Release Date" value={values.releaseDate ? formatDate(values.releaseDate) : undefined} />
                <Row label="Status" value={<span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">For Approval on submit</span>} />
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold text-gray-900">Validation</h2>
              <div
                role="status"
                className={cn(
                  "mt-3 flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium",
                  allComplete ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800",
                )}
              >
                {allComplete ? <CheckCircle2 className="size-5 fill-green-600 text-white" aria-hidden /> : <Info className="size-5" aria-hidden />}
                {allComplete ? "All required fields are completed." : "Complete the required fields to submit."}
              </div>
              <ul className="mt-4 space-y-3 text-sm text-gray-700">
                <Check2 done={sectionDone.appropriation} label="Appropriation Information" />
                <Check2 done={sectionDone.details} label="Allotment Details" />
                <Check2 done={documents.length > 0} label="Supporting Documents" optional />
              </ul>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" onClick={onCancel} disabled={saving}><X className="size-4" /> Cancel</Button>
              <Button variant="outline" size="lg" onClick={onSaveDraft} loading={saving && originalArgs?.draft} disabled={saving}>
                {!(saving && originalArgs?.draft) && <Save className="size-4" />} Save as Draft
              </Button>
              <Button type="submit" size="lg" className="col-span-2" loading={saving && !originalArgs?.draft} disabled={saving}>
                {!(saving && !originalArgs?.draft) && <Check className="size-4" />} Submit for Approval
              </Button>
            </div>
          </aside>
        </form>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="break-words text-gray-900">{value || value === 0 ? value : <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}

function Check2({ done, label, optional }: { done: boolean; label: string; optional?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      {done ? <CheckCircle2 className="size-5 fill-green-600 text-white" aria-label="Complete" /> : <Circle className="size-5 text-gray-300" aria-label="Incomplete" />}
      {label}
      {optional && !done && <span className="text-xs text-gray-400">(optional)</span>}
    </li>
  );
}
