"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CloudUpload, Copy, Download, Eye, FileText, Info, ListChecks, Paperclip, Pencil, Plus, Save, Search, Send, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, fieldClasses } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { AmountInput } from "@/components/forms/AmountInput";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { applyServerErrors } from "@/components/forms/applyServerErrors";
import { FISCAL_YEARS } from "@/config/site";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import type { AllotmentClassMeta } from "@/lib/constants/allotment-classes";
import { toOptions } from "@/lib/constants/options";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/utils/format";
import { useGetAppropriationLookupsQuery, useGetAppropriationsQuery } from "@/features/appropriations/services/appropriationsApi";
import { useGetObligationLookupsQuery } from "@/features/obligation-management/services/obligationsApi";
import {
  useAllotmentWorkflowMutation,
  useCreateRegistryAllotmentMutation,
  useGetNextAllotmentNumberQuery,
  useGetRegistryLookupsQuery,
  useUpdateRegistryAllotmentMutation,
  useUploadAllotmentDocumentMutation,
} from "@/features/allotments/services/allotmentsApi";
import { TRANCHE_TYPES, type AllotmentDetail, type AllotmentDocument, type RegistryAllotmentInput } from "@/features/allotments/types";
import { WIZARD_STEP_FIELDS, registryWizardSchema, type RegistryWizardValues } from "../../schemas";

const STEPS = ["Allotment Details", "Line Items", "Supporting Documents", "Review and Submit"];
const STEP_DESCRIPTIONS = [
  "Enter the allotment details for the selected appropriation.",
  "Add allotment line items for the selected allotment.",
  "Upload and manage supporting documents for the allotment.",
  "Review all details and attached documents before submission.",
];
const emptyLine = { uacsCode: "", description: "", quantity: 1, unit: "unit", unitCost: Number.NaN, remarks: "" };

export function Head({ icon: Icon, title, action, tone = "text-brand-600" }: { icon: typeof Info; title: string; action?: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Icon className={cn("size-5", tone)} aria-hidden /> {title}</h2>
      {action}
    </div>
  );
}

export function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2 border-b border-gray-50 py-1.5 text-sm last:border-0">
      <dt className="text-blue-900">{label}</dt>
      <dd className="text-gray-900">{children || "—"}</dd>
    </div>
  );
}

/** New / edit allotment as a 4-step wizard (RAOCO screens). */
export function RegistryAllotmentWizard({ meta, existing }: { meta: AllotmentClassMeta; existing?: AllotmentDetail }) {
  const router = useRouter();
  const notify = useNotify();
  const headerFy = useFiscalYear();
  const editing = existing?.allotment;
  const [step, setStep] = useState(0);
  const lookups = useGetRegistryLookupsQuery(meta.code);
  const appLookups = useGetAppropriationLookupsQuery();
  const oblLookups = useGetObligationLookupsQuery();
  const [uploadDoc, { isLoading: uploading }] = useUploadAllotmentDocumentMutation();
  const [create] = useCreateRegistryAllotmentMutation();
  const [update] = useUpdateRegistryAllotmentMutation();
  const [runWorkflow] = useAllotmentWorkflowMutation();
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<AllotmentDocument[]>(editing?.documents ?? []);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [docCategory, setDocCategory] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [uacsQuery, setUacsQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const schemaRef = useRef(registryWizardSchema(null));
  const form = useForm<RegistryWizardValues>({
    resolver: (v, c, o) => zodResolver(schemaRef.current)(v, c, o),
    mode: "onTouched",
    defaultValues: editing
      ? {
          fiscalYear: editing.fiscalYear,
          appropriationRef: editing.appropriationRef,
          tranche: editing.tranche,
          date: editing.date.slice(0, 10),
          gaaReferenceNo: editing.gaaReferenceNo ?? "",
          department: editing.department ?? "",
          responsibilityCenter: editing.responsibilityCenter ?? "",
          fundSource: editing.fundSource,
          uacsCode: editing.uacsCode,
          purpose: editing.purpose,
          amount: editing.amount,
          remarks: editing.remarks ?? "",
          requiredDocuments: editing.requiredDocuments ?? [],
          lineItems: (editing.lineItems ?? []).map(({ uacsCode, description, quantity, unit, unitCost, remarks }) => ({ uacsCode, description, quantity, unit, unitCost, remarks })),
        }
      : {
          fiscalYear: headerFy,
          appropriationRef: "",
          tranche: "1st Tranche",
          date: new Date().toISOString().slice(0, 10),
          gaaReferenceNo: "",
          department: "",
          responsibilityCenter: "",
          fundSource: "",
          uacsCode: "",
          purpose: "",
          amount: Number.NaN,
          remarks: "",
          requiredDocuments: [],
          lineItems: [{ ...emptyLine }],
        },
  });
  const { control, register, setValue, getValues, trigger, handleSubmit, setError, formState } = form;
  const { fields, append, remove, insert } = useFieldArray({ control, name: "lineItems" });
  const values = useWatch({ control }) as Partial<RegistryWizardValues>;
  const errors = formState.errors;
  const fy = values.fiscalYear ?? headerFy;

  const appropriations = useGetAppropriationsQuery({ fiscalYear: fy, allotmentClass: meta.code, pageSize: 100 });
  const nextNumber = useGetNextAllotmentNumberQuery({ fiscalYear: fy }, { skip: !!editing });
  const options = useMemo(() => appropriations.data?.items.filter((a) => a.status !== "Draft") ?? [], [appropriations.data]);
  const app = options.find((a) => a.referenceNo === values.appropriationRef);
  const remaining = app ? app.amount - app.allotted + (editing && editing.appropriationRef === app.referenceNo && editing.status !== "Draft" ? editing.amount : 0) : null;
  schemaRef.current = useMemo(() => registryWizardSchema(remaining), [remaining]);

  const lineAmount = (li?: Partial<RegistryWizardValues["lineItems"][number]>) =>
    li && Number.isFinite(li.quantity) && Number.isFinite(li.unitCost) ? Number(li.quantity) * Number(li.unitCost) : 0;
  const lines = values.lineItems ?? [];
  const lineTotal = lines.reduce((s, li) => s + lineAmount(li), 0);
  const total = Number.isFinite(values.amount) ? Number(values.amount) : 0;

  const lastApp = useRef(editing?.appropriationRef ?? "");
  useEffect(() => {
    if (!app || lastApp.current === app.referenceNo) return;
    lastApp.current = app.referenceNo;
    setValue("fundSource", app.fundSource);
    if (!getValues("uacsCode")) setValue("uacsCode", app.uacsCode);
    if (!getValues("gaaReferenceNo")) setValue("gaaReferenceNo", app.gaaReference);
    if (!getValues("purpose")) setValue("purpose", app.title);
  }, [app, setValue, getValues]);

  const uacsMatches = useMemo(() => {
    const q = uacsQuery.trim().toLowerCase();
    if (!q) return [];
    return (appLookups.data?.uacsCodes ?? []).filter((u) => u.code.includes(q) || u.description.toLowerCase().includes(q)).slice(0, 6);
  }, [uacsQuery, appLookups.data]);
  const uacsInfo = appLookups.data?.uacsCodes.find((u) => u.code === values.uacsCode?.trim());

  const goTo = async (target: number) => {
    if (target > step) {
      for (let s = step; s < target; s++) {
        const ok = await trigger(WIZARD_STEP_FIELDS[s] as (keyof RegistryWizardValues)[]);
        if (!ok) {
          setStep(s);
          return;
        }
      }
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toInput = (v: Partial<RegistryWizardValues>): RegistryAllotmentInput => ({
    fiscalYear: v.fiscalYear ?? headerFy,
    appropriationRef: v.appropriationRef ?? "",
    allotmentClass: meta.code,
    tranche: v.tranche ?? "1st Tranche",
    date: v.date ?? "",
    gaaReferenceNo: v.gaaReferenceNo ?? "",
    department: v.department ?? "",
    responsibilityCenter: v.responsibilityCenter || v.department || "",
    fundSource: v.fundSource ?? "",
    uacsCode: v.uacsCode ?? "",
    purpose: v.purpose ?? "",
    remarks: v.remarks ?? "",
    amount: Number.isFinite(v.amount) ? Number(v.amount) : undefined,
    requiredDocuments: v.requiredDocuments ?? [],
    lineItems: (v.lineItems ?? [])
      .filter((li) => li.uacsCode || li.description)
      .map((li) => ({
        uacsCode: li.uacsCode ?? "",
        description: li.description ?? "",
        quantity: Number.isFinite(li.quantity) ? Number(li.quantity) : 0,
        unit: li.unit ?? "",
        unitCost: Number.isFinite(li.unitCost) ? Number(li.unitCost) : 0,
        remarks: li.remarks ?? "",
      })),
    documentIds: documents.map((d) => d.id),
  });

  const save = async (v: Partial<RegistryWizardValues>, intent: "draft" | "submit") => {
    setPending(intent);
    setSaveError(null);
    try {
      const input = toInput(v);
      const record = editing ? await update({ id: editing.id, ...input }).unwrap() : await create(input).unwrap();
      if (intent === "draft") {
        notify("success", "Draft saved", `${record.allotmentNo} was saved as a draft.`);
        router.push(ROUTES.allotmentClass(meta.slug));
        return;
      }
      await runWorkflow({ id: record.id, action: "submit", remarks: v.remarks?.trim() || undefined }).unwrap();
      notify("success", "Submitted for approval", `${record.allotmentNo} was forwarded to the Budget Head for review.`);
      router.push(ROUTES.classAllotment(meta.slug, record.id));
    } catch (err) {
      if (!applyServerErrors(err, setError)) setSaveError(getErrorMessage(err));
      else setSaveError(getErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const onDraft = () => {
    if (!getValues("appropriationRef")) {
      setStep(0);
      setError("appropriationRef", { message: "Select the reference appropriation to save a draft" });
      return;
    }
    void save(getValues(), "draft");
  };
  const onSubmit = handleSubmit(
    (v) => save(v, "submit"),
    (errs) => {
      const firstBad = WIZARD_STEP_FIELDS.findIndex((fieldsOf) => fieldsOf.some((f) => f in errs));
      if (firstBad >= 0) setStep(firstBad);
    },
  );

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        notify("error", "File too large", `${file.name} is larger than 10 MB.`);
        continue;
      }
      try {
        const doc = await uploadDoc({ file, category: docCategory, description: docDescription }).unwrap();
        setDocuments((d) => [...d, doc]);
      } catch (err) {
        notify("error", `Unable to upload ${file.name}`, getErrorMessage(err));
      }
    }
    setDocDescription("");
    if (fileRef.current) fileRef.current.value = "";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  const requiredList = lookups.data?.requiredDocuments ?? [];
  const mandatory = requiredList.filter((d) => !d.startsWith("Others"));
  const checklist = [
    { label: "Allotment details are correct", ok: !WIZARD_STEP_FIELDS[0].some((f) => errors[f]) && !!values.appropriationRef && total > 0 },
    { label: "Line items are encoded and verified", ok: lines.length > 0 && lines.every((li) => li.uacsCode && li.description && lineAmount(li) > 0) },
    { label: "Required supporting documents are attached", ok: documents.length > 0 && mandatory.every((d) => values.requiredDocuments?.includes(d)) },
    { label: "UACS codes are valid", ok: [values.uacsCode ?? "", ...lines.map((l) => l.uacsCode ?? "")].every((c) => /^\d+$/.test(c)) },
    { label: "Total amount is within the approved GAA and available balance", ok: remaining !== null && total <= remaining && lineTotal <= total },
  ];
  const allChecked = checklist.every((c) => c.ok);

  if (lookups.isLoading || appropriations.isLoading) {
    return <><PageHeader title={`New ${meta.code} Allotment`} extraCrumbs={["New Allotment"]} /><Skeleton className="h-[640px] w-full rounded-xl" /></>;
  }

  const err = (n: keyof RegistryWizardValues) => errors[n]?.message as string | undefined;
  const inv = (n: keyof RegistryWizardValues) => ({ invalid: !!errors[n], "aria-describedby": errors[n] ? `${n}-error` : undefined });
  const fundName = appLookups.data?.fundSources.find((f) => f.code === values.fundSource)?.name ?? "";
  const allotmentNo = editing?.allotmentNo ?? nextNumber.data?.allotmentNo ?? "";

  const infoCard = (editable: boolean) => (
    <Card>
      <Head icon={FileText} title="Allotment Information" action={editable ? <Button variant="outline" size="sm" onClick={() => setStep(0)}><Pencil className="size-3.5" /> Edit</Button> : undefined} />
      <div className={cn("grid gap-x-8 px-5 py-3", editable ? "md:grid-cols-2 xl:grid-cols-1" : "lg:grid-cols-3")}>
        <dl>
          <Pair label="Allotment No.">{allotmentNo}</Pair>
          <Pair label="Fiscal Year">FY {values.fiscalYear}</Pair>
          <Pair label="Tranche">{values.tranche}</Pair>
          <Pair label="Allotment Date">{values.date ? formatDate(values.date) : ""}</Pair>
        </dl>
        <dl>
          <Pair label="Department/Office">{values.department}</Pair>
          <Pair label="Responsibility Center">{values.responsibilityCenter || values.department}</Pair>
          <Pair label="Funding Source">{values.fundSource ? `${values.fundSource} - ${fundName}` : ""}</Pair>
          <Pair label="GAA Reference No.">{values.gaaReferenceNo}</Pair>
        </dl>
        <dl>
          <Pair label="Allotment Class">{meta.code} - {meta.expenseClass}</Pair>
          <Pair label="UACS Code">{values.uacsCode}{uacsInfo ? ` - ${uacsInfo.description}` : ""}</Pair>
          <Pair label="Total Allotment Amount">{formatCurrency(total)}</Pair>
          <Pair label="Remaining Balance"><span className={cn("font-semibold", total - lineTotal < 0 ? "text-red-600" : "text-green-700")}>{formatCurrency(total - lineTotal)}</span></Pair>
        </dl>
      </div>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={step === 3 ? `Review and Submit – ${meta.code} Allotment` : editing ? `Edit ${editing.allotmentNo}` : `New ${meta.code} Allotment`}
        description={STEP_DESCRIPTIONS[step]}
        extraCrumbs={[step === 3 ? "Review and Submit" : editing ? editing.allotmentNo : `New ${meta.code} Allotment`]}
      />

      <Card className="mb-5 px-3 py-5 sm:px-6">
        <ol className="grid grid-cols-4 gap-1" aria-label="Allotment wizard steps">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
                {i < STEPS.length - 1 && <span aria-hidden className={cn("absolute top-4 left-1/2 h-0.5 w-full", done ? "bg-green-600" : "bg-gray-200")} />}
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn(
                    "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                    done ? "border-green-600 bg-green-600 text-white" : current ? "border-blue-600 bg-blue-600 text-white" : "border-gray-400 bg-white text-gray-600",
                  )}
                  aria-label={`Go to step ${i + 1}: ${label}`}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </button>
                <span className={cn("mt-2 text-xs font-medium sm:text-sm", current ? "text-gray-900" : "text-blue-900")}>{label}</span>
                <span className={cn("text-[11px] sm:text-xs", current ? "font-medium text-brand-600" : "text-gray-500")}>{done ? "Completed" : current ? "Current Step" : "Pending"}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      {editing?.status === "Returned" && <div className="mb-5"><FormAlert>Returned for revision: {editing.workflow.find((s) => s.status === "returned")?.remarks ?? "see the approval history."}</FormAlert></div>}
      {saveError && <div className="mb-5"><FormAlert>{saveError}</FormAlert></div>}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {step === 0 && (
          <Card>
            <Head icon={FileText} title="Allotment Details" action={<span className="rounded-lg bg-green-100 px-3 py-1 text-sm font-bold text-green-700">{meta.code}</span>} />
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Allotment No." htmlFor="allotmentNo" hint={editing ? undefined : "Assigned when saved"}><Input id="allotmentNo" readOnly value={allotmentNo} className="bg-gray-50" /></FormField>
              <FormField label="Fiscal Year" htmlFor="fiscalYear" required>
                <Select id="fiscalYear" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: `FY ${y}` }))} {...register("fiscalYear", { valueAsNumber: true, onChange: () => setValue("appropriationRef", "") })} />
              </FormField>
              <FormField label="Tranche" htmlFor="tranche" required><Select id="tranche" options={toOptions(TRANCHE_TYPES)} {...register("tranche")} /></FormField>
              <FormField label="Reference (GAA) Appropriation" htmlFor="appropriationRef" required error={err("appropriationRef")} hint={remaining !== null ? `Unallotted balance: ${formatCurrency(remaining)}` : undefined} className="md:col-span-2">
                <Select id="appropriationRef" placeholder="Select appropriation" options={options.map((a) => ({ value: a.referenceNo, label: `${a.referenceNo} · ${a.title}` }))} {...inv("appropriationRef")} {...register("appropriationRef")} />
              </FormField>
              <FormField label="Allotment Date" htmlFor="date" required error={err("date")}><Input id="date" type="date" {...inv("date")} {...register("date")} /></FormField>
              <FormField label="Department/Office" htmlFor="department" required error={err("department")}>
                <Select id="department" placeholder="Select department/office" options={(lookups.data?.departments ?? []).map((d) => ({ value: d, label: d }))} {...inv("department")} {...register("department")} />
              </FormField>
              <FormField label="Responsibility Center" htmlFor="responsibilityCenter"><Input id="responsibilityCenter" placeholder={values.department || "Same as department"} {...register("responsibilityCenter")} /></FormField>
              <FormField label="Funding Source" htmlFor="fundSource" required error={err("fundSource")}>
                <Select id="fundSource" placeholder="Select funding source" options={appLookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []} {...inv("fundSource")} {...register("fundSource")} />
              </FormField>
              <FormField label="GAA Reference No." htmlFor="gaaReferenceNo" required error={err("gaaReferenceNo")}><Input id="gaaReferenceNo" placeholder="e.g. GAA-2026-0085" {...inv("gaaReferenceNo")} {...register("gaaReferenceNo")} /></FormField>
              <FormField label="UACS Code" htmlFor="uacsCode" required error={err("uacsCode")} hint={uacsInfo ? `${uacsInfo.description} · Major ${values.uacsCode?.slice(0, 3)}` : values.uacsCode ? "Not in the eBudget UACS list" : undefined}>
                <Input id="uacsCode" inputMode="numeric" {...inv("uacsCode")} {...register("uacsCode")} />
              </FormField>
              <FormField label="Total Allotment Amount" htmlFor="amount" required error={err("amount")}>
                <AmountInput id="amount" value={values.amount} onChange={(v) => setValue("amount", v, { shouldValidate: formState.isSubmitted || !!errors.amount })} invalid={!!errors.amount} describedBy={errors.amount ? "amount-error" : undefined} />
              </FormField>
              <FormField label="Particulars / Description" htmlFor="purpose" required error={err("purpose")} className="md:col-span-2 xl:col-span-3">
                <Textarea id="purpose" rows={2} maxLength={500} {...inv("purpose")} {...register("purpose")} />
              </FormField>
            </div>
          </Card>
        )}

        {step === 1 && (
          <>
            {infoCard(false)}
            <Card className="overflow-hidden">
              <Head
                icon={ListChecks}
                title="Allotment Line Items"
                tone="text-green-600"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => append({ ...emptyLine })}><Plus className="size-4" /> Add Line Item</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!app}
                      title={app ? `Add a line from ${app.referenceNo}` : "Select an appropriation first"}
                      onClick={() => app && append({ uacsCode: app.uacsCode, description: app.title, quantity: 1, unit: "lot", unitCost: Math.max(total - lineTotal, 0) || Number.NaN, remarks: `From ${app.referenceNo}` })}
                    >
                      <Download className="size-4" /> Import from GAA
                    </Button>
                  </div>
                }
              />
              {(errors.lineItems?.message || errors.lineItems?.root?.message) && <p className="px-5 pt-3 text-sm text-red-600" role="alert">{errors.lineItems?.message ?? errors.lineItems?.root?.message}</p>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <caption className="sr-only">Line items</caption>
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-700">
                      <th scope="col" className="w-10 px-2 py-2.5 pl-5">#</th>
                      <th scope="col" className="w-36 px-2 py-2.5">UACS Code</th>
                      <th scope="col" className="px-2 py-2.5">Particulars / Description</th>
                      <th scope="col" className="w-20 px-2 py-2.5">Qty</th>
                      <th scope="col" className="w-24 px-2 py-2.5">Unit</th>
                      <th scope="col" className="w-28 px-2 py-2.5">Unit Cost (₱)</th>
                      <th scope="col" className="w-32 px-2 py-2.5 text-right">Amount (₱)</th>
                      <th scope="col" className="px-2 py-2.5">Remarks</th>
                      <th scope="col" className="w-20 px-2 py-2.5 pr-5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fields.map((f, i) => {
                      const e = errors.lineItems?.[i];
                      const cell = (bad?: unknown) => cn(fieldClasses, "h-9 px-2", !!bad && "border-red-400");
                      return (
                        <tr key={f.id} className="align-top">
                          <td className="px-2 py-2 pt-4 pl-5 text-gray-600">{i + 1}</td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} UACS code`} inputMode="numeric" className={cell(e?.uacsCode)} {...register(`lineItems.${i}.uacsCode`)} />{e?.uacsCode && <p className="mt-1 text-xs text-red-600">{e.uacsCode.message}</p>}</td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} description`} className={cell(e?.description)} {...register(`lineItems.${i}.description`)} />{e?.description && <p className="mt-1 text-xs text-red-600">{e.description.message}</p>}</td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} quantity`} type="number" min={0} step="any" className={cn(cell(e?.quantity), "text-right")} {...register(`lineItems.${i}.quantity`, { valueAsNumber: true })} /></td>
                          <td className="px-2 py-2"><select aria-label={`Line ${i + 1} unit`} className={cell(e?.unit)} {...register(`lineItems.${i}.unit`)}>{(oblLookups.data?.units ?? ["unit"]).map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} unit cost`} type="number" min={0} step="0.01" className={cn(cell(e?.unitCost), "text-right")} {...register(`lineItems.${i}.unitCost`, { valueAsNumber: true })} /></td>
                          <td className="px-2 py-2 pt-4 text-right tabular-nums">{formatCurrency(lineAmount(lines[i])).replace("₱", "")}</td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} remarks`} className={cell()} {...register(`lineItems.${i}.remarks`)} /></td>
                          <td className="px-2 py-2 pr-5">
                            <span className="flex justify-center gap-1">
                              <button type="button" onClick={() => insert(i + 1, { ...getValues(`lineItems.${i}`) })} className="rounded p-1.5 text-blue-600 hover:bg-blue-50" aria-label={`Duplicate line ${i + 1}`}><Copy className="size-4" /></button>
                              <button type="button" onClick={() => remove(i)} disabled={fields.length === 1} className="rounded p-1.5 text-brand-600 hover:bg-red-50 disabled:opacity-30" aria-label={`Remove line ${i + 1}`}><Trash2 className="size-4" /></button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} />
                      <td colSpan={3} className="bg-blue-50 px-3 py-3"><span className="flex justify-between font-semibold">Total Amount (₱) <span className="text-lg tabular-nums text-blue-800">{formatCurrency(lineTotal).replace("₱", "")}</span></span></td>
                      <td colSpan={2} className="bg-green-50 px-3 py-3 pr-5"><span className="flex justify-between gap-2 font-semibold text-green-800">Remaining Balance (₱) <span className={cn("text-lg tabular-nums", total - lineTotal < 0 && "text-red-600")}>{formatCurrency(total - lineTotal).replace("₱", "")}</span></span></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
            <Card>
              <Head icon={Search} title="UACS Lookup (Optional)" tone="text-purple-600" />
              <div className="space-y-3 p-5">
                <label htmlFor="uacs-search" className="block text-sm font-medium text-gray-700">Search UACS</label>
                <Input id="uacs-search" value={uacsQuery} onChange={(e) => setUacsQuery(e.target.value)} placeholder="Search by code or description…" leftIcon={<Search className="size-4" />} />
                {uacsQuery && (
                  uacsMatches.length ? (
                    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
                      {uacsMatches.map((u) => (
                        <li key={u.code} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span><span className="font-medium tabular-nums">{u.code}</span> – {u.description} <span className="text-xs text-gray-500">(Major {u.code.slice(0, 3)})</span></span>
                          <Button size="sm" variant="outline" onClick={() => append({ ...emptyLine, uacsCode: u.code, description: u.description })}><Plus className="size-3.5" /> Add line</Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No UACS codes match “{uacsQuery}”.</p>
                  )
                )}
              </div>
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            {infoCard(false)}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <Card>
                <Head icon={Paperclip} title="Upload Supporting Documents" tone="text-purple-600" />
                <div className="space-y-3 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Document Category" htmlFor="doc-category">
                      <Select id="doc-category" value={docCategory} onChange={(e) => setDocCategory(e.target.value)} placeholder="Select category" options={(lookups.data?.documentCategories ?? []).map((c) => ({ value: c, label: c }))} />
                    </FormField>
                    <FormField label="Description" htmlFor="doc-description"><Input id="doc-description" value={docDescription} onChange={(e) => setDocDescription(e.target.value)} placeholder="e.g. Purchase Request for ICT Equipment" /></FormField>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn("flex min-h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center", dragging ? "border-blue-500 bg-blue-50" : "border-blue-300")}
                  >
                    <CloudUpload className="size-12 text-blue-600" aria-hidden />
                    <p className="mt-2 text-gray-800">Drag and drop files here, or <button type="button" onClick={() => fileRef.current?.click()} className="font-semibold text-blue-600 hover:underline">click to browse</button></p>
                    <p className="mt-1 text-xs text-gray-500">Supported file types: PDF, XLS, XLSX, JPG, PNG · Maximum file size: 10 MB per file</p>
                    {uploading && <p className="mt-2 text-xs text-blue-700">Uploading…</p>}
                    <input ref={fileRef} type="file" multiple accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png" className="sr-only" aria-label="Upload supporting documents" onChange={(e) => void addFiles(e.target.files)} />
                  </div>
                </div>
              </Card>
              <Card>
                <Head icon={ListChecks} title="Required Documents" tone="text-green-600" />
                <fieldset className="space-y-2.5 p-5">
                  <legend className="sr-only">Required documents</legend>
                  {requiredList.map((d) => (
                    <label key={d} className="flex items-center gap-2.5 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        className="size-[18px] accent-blue-600"
                        checked={values.requiredDocuments?.includes(d) ?? false}
                        onChange={(e) => {
                          const cur = getValues("requiredDocuments") ?? [];
                          setValue("requiredDocuments", e.target.checked ? [...cur, d] : cur.filter((x) => x !== d), { shouldDirty: true });
                        }}
                      />
                      {d} {!d.startsWith("Others") && <span className="text-brand-600">*</span>}
                    </label>
                  ))}
                  <p className="pt-2 text-xs text-gray-500">Tick each document once it is attached.</p>
                </fieldset>
              </Card>
            </div>
            <Card className="overflow-hidden">
              <Head
                icon={FileText}
                title={`Uploaded Documents (${documents.length})`}
                tone="text-purple-600"
                action={
                  <Button variant="outline" size="sm" disabled={!selectedDocs.size} onClick={() => { setDocuments((d) => d.filter((x) => !selectedDocs.has(x.id))); setSelectedDocs(new Set()); }}>
                    <Trash2 className="size-4" /> Delete Selected
                  </Button>
                }
              />
              <DocsTable documents={documents} selected={selectedDocs} onSelect={setSelectedDocs} onRemove={(id) => setDocuments((d) => d.filter((x) => x.id !== id))} />
            </Card>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {infoCard(true)}
              <Card className="overflow-hidden">
                <Head icon={Paperclip} title="Supporting Documents" tone="text-purple-600" action={<Button variant="outline" size="sm" onClick={() => setStep(2)}><Pencil className="size-3.5" /> Edit</Button>} />
                <DocsTable documents={documents} />
              </Card>
              <Card className="overflow-hidden">
                <Head icon={ListChecks} title="Line Items Summary" tone="text-green-600" action={<Button variant="outline" size="sm" onClick={() => setStep(1)}><Pencil className="size-3.5" /> Edit</Button>} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <caption className="sr-only">Line items summary</caption>
                    <thead>
                      <tr className="bg-gray-50 text-gray-700">
                        {["#", "UACS Code", "Particulars / Description", "Qty", "Unit", "Unit Cost (₱)", "Amount (₱)"].map((h, i) => <th key={h} scope="col" className={cn("px-3 py-2 first:pl-5 last:pr-5", [3, 5, 6].includes(i) ? "text-right" : "text-left")}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.map((li, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 pl-5">{i + 1}</td>
                          <td className="px-3 py-2 text-blue-700 tabular-nums">{li.uacsCode}</td>
                          <td className="px-3 py-2">{li.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{li.quantity}</td>
                          <td className="px-3 py-2">{li.unit}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{Number.isFinite(li.unitCost) ? formatCurrency(Number(li.unitCost)).replace("₱", "") : "—"}</td>
                          <td className="px-3 py-2 pr-5 text-right tabular-nums">{formatCurrency(lineAmount(li)).replace("₱", "")}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td colSpan={5} /><td colSpan={2} className="bg-blue-50 px-3 py-2.5 pr-5"><span className="flex justify-between font-semibold">Total (₱) <span className="tabular-nums text-blue-800">{formatCurrency(lineTotal).replace("₱", "")}</span></span></td></tr></tfoot>
                  </table>
                </div>
              </Card>
              <Card>
                <Head icon={CheckCircle2} title="Checklist" tone="text-green-600" />
                <ul className="divide-y divide-gray-50 p-5 text-sm">
                  {checklist.map((c) => (
                    <li key={c.label} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2.5">
                        {c.ok ? <CheckCircle2 className="size-5 fill-green-600 text-white" aria-hidden /> : <XCircle className="size-5 fill-red-600 text-white" aria-hidden />}
                        {c.label}
                      </span>
                      <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", c.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700")}>{c.ok ? "Complete" : "Incomplete"}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <Head icon={FileText} title="Remarks" tone="text-amber-500" />
                <div className="p-5">
                  <label htmlFor="remarks" className="sr-only">Remarks</label>
                  <Textarea id="remarks" rows={3} maxLength={500} placeholder="e.g. For procurement of ICT equipment – 1st Tranche FY 2026." {...register("remarks")} />
                  <p className="text-right text-xs text-gray-500">{(values.remarks ?? "").length}/500</p>
                </div>
              </Card>
              <Card className="flex flex-col items-center justify-center gap-3 bg-blue-50/60 p-6 text-center">
                <Send className="size-8 text-blue-700" aria-hidden />
                <p className="font-semibold text-blue-900">Submit for Approval</p>
                <p className="text-sm text-blue-900/80">By clicking Submit, this {meta.code} allotment will be forwarded to the Budget Head for review.</p>
                {!allChecked && <p className="text-xs text-red-600">Complete the checklist before submitting.</p>}
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={!allChecked || !!pending} loading={pending === "submit"}>Submit for Approval</Button>
              </Card>
            </div>
          </>
        )}

        <div className="bottom-0 z-20 -mx-4 sm:sticky border-t border-gray-200 bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap justify-between gap-3">
            {step === 0 ? (
              <Button variant="outline" size="lg" onClick={() => router.push(editing ? ROUTES.classAllotment(meta.slug, editing.id) : ROUTES.allotmentClass(meta.slug))}><ArrowLeft className="size-4" /> {editing ? "Back to Details" : "Back to List"}</Button>
            ) : (
              <Button variant="outline" size="lg" onClick={() => goTo(step - 1)} className="h-auto py-1.5">
                <ArrowLeft className="size-4" />
                <span className="text-left leading-tight">Previous<span className="block text-xs font-normal text-gray-500">{STEPS[step - 1]}</span></span>
              </Button>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="lg" onClick={onDraft} loading={pending === "draft"} disabled={!!pending}>{pending !== "draft" && <Save className="size-4" />} Save as Draft</Button>
              {step < 3 ? (
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => goTo(step + 1)}><ArrowRight className="size-4" /> Next: {STEPS[step + 1]}</Button>
              ) : (
                <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700" disabled={!allChecked || !!pending} loading={pending === "submit"}><ArrowRight className="size-4" /> Submit for Approval</Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

const CATEGORY_TONES: Record<string, string> = {
  GAA: "bg-blue-100 text-blue-800",
  "Purchase Request": "bg-green-100 text-green-800",
  PPMP: "bg-amber-100 text-amber-800",
  Canvass: "bg-purple-100 text-purple-800",
  "Technical Specification": "bg-yellow-100 text-yellow-800",
};

export function DocsTable({
  documents,
  selected,
  onSelect,
  onRemove,
}: {
  documents: AllotmentDocument[];
  selected?: Set<string>;
  onSelect?: (s: Set<string>) => void;
  onRemove?: (id: string) => void;
}) {
  if (!documents.length) return <p className="p-5 text-sm text-gray-500">No documents uploaded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Uploaded documents</caption>
        <thead>
          <tr className="bg-gray-50 text-left text-gray-700">
            {onSelect && <th scope="col" className="w-10 px-3 py-2 pl-5"><span className="sr-only">Select</span></th>}
            {["#", "File Name", "File Type", "Size", "Category", "Description", "Uploaded By", "Date Uploaded", "Actions"].map((h) => <th key={h} scope="col" className="px-3 py-2 whitespace-nowrap first:pl-5 last:pr-5">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {documents.map((d, i) => (
            <tr key={d.id}>
              {onSelect && selected && (
                <td className="px-3 py-2 pl-5">
                  <input type="checkbox" aria-label={`Select ${d.name}`} className="size-4 accent-blue-600" checked={selected.has(d.id)} onChange={() => { const n = new Set(selected); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); onSelect(n); }} />
                </td>
              )}
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-700 underline-offset-2 hover:underline">{d.name}</a> : d.name}</td>
              <td className="px-3 py-2">{d.name.split(".").pop()?.toUpperCase()}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatFileSize(d.size)}</td>
              <td className="px-3 py-2">{d.category ? <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", CATEGORY_TONES[d.category] ?? "bg-gray-100 text-gray-700")}>{d.category}</span> : "—"}</td>
              <td className="px-3 py-2">{d.description || "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">{d.uploadedBy ?? "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(d.uploadedAt)}</td>
              <td className="px-3 py-2 pr-5">
                <span className="flex gap-1">
                  {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-blue-700 hover:bg-blue-50" aria-label={`View ${d.name}`}><Eye className="size-4" /></a>}
                  {d.url && <a href={d.url} download={d.name} className="rounded p-1.5 text-blue-700 hover:bg-blue-50" aria-label={`Download ${d.name}`}><Download className="size-4" /></a>}
                  {onRemove && <button type="button" onClick={() => onRemove(d.id)} className="rounded p-1.5 text-brand-600 hover:bg-red-50" aria-label={`Remove ${d.name}`}><Trash2 className="size-4" /></button>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
