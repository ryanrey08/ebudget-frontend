"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart3, ChevronLeft, Info, ListChecks, Paperclip, Plus, Save, Search, Send, Shield, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, fieldClasses } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { DocumentsField } from "@/components/forms/DocumentsField";
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
import { formatCurrency } from "@/lib/utils/format";
import { useGetAppropriationLookupsQuery, useGetAppropriationsQuery } from "@/features/appropriations/services/appropriationsApi";
import { useGetObligationLookupsQuery } from "@/features/obligation-management/services/obligationsApi";
import {
  useCreateRegistryAllotmentMutation,
  useGetNextAllotmentNumberQuery,
  useGetRegistryLookupsQuery,
  useUpdateRegistryAllotmentMutation,
  useUploadAllotmentDocumentMutation,
} from "@/features/allotments/services/allotmentsApi";
import { TRANCHE_TYPES, type AllotmentDetail, type AllotmentDocument, type RegistryAllotmentInput } from "@/features/allotments/types";
import { registryAllotmentSchema, type RegistryAllotmentValues } from "../../schemas";
import { registryConfig } from "../../registryConfig";
import { REGISTRY_STEP_LABELS } from "../../registryWorkflow";

const emptyLine = { uacsCode: "", description: "", quantity: 1, unit: "piece", unitCost: Number.NaN, remarks: "" };

function Head({ icon: Icon, title, action }: { icon: typeof Info; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Icon className="size-5 text-brand-600" aria-hidden /> {title}</h2>
      {action}
    </div>
  );
}

/** New / edit allotment for an allotment-class page (RAOPS design). */
export function RegistryAllotmentForm({ meta, existing }: { meta: AllotmentClassMeta; existing?: AllotmentDetail }) {
  const router = useRouter();
  const notify = useNotify();
  const headerFy = useFiscalYear();
  const editing = existing?.allotment;
  const config = registryConfig(meta.slug);
  const lookups = useGetRegistryLookupsQuery(meta.code);
  const appLookups = useGetAppropriationLookupsQuery();
  const oblLookups = useGetObligationLookupsQuery();
  const [uploadDoc] = useUploadAllotmentDocumentMutation();
  const [create, createState] = useCreateRegistryAllotmentMutation();
  const [update, updateState] = useUpdateRegistryAllotmentMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const saveError = createState.error ?? updateState.error;
  const [documents, setDocuments] = useState<AllotmentDocument[]>(editing?.documents ?? []);
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const [uacsHint, setUacsHint] = useState<string | null>(null);

  const schemaRef = useRef(registryAllotmentSchema(null));
  const form = useForm<RegistryAllotmentValues>({
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
          remarks: editing.remarks ?? "",
          effectivityDate: editing.effectivityDate ?? "",
          validityDate: editing.validityDate ?? "",
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
          remarks: "",
          effectivityDate: `${headerFy}-01-01`,
          validityDate: `${headerFy}-12-31`,
          lineItems: [{ ...emptyLine }],
        },
  });
  const { control, register, setValue, getValues, handleSubmit, setError, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const values = useWatch({ control }) as Partial<RegistryAllotmentValues>;
  const errors = formState.errors;
  const fy = values.fiscalYear ?? headerFy;

  const appropriations = useGetAppropriationsQuery({ fiscalYear: fy, allotmentClass: meta.code, pageSize: 100 });
  const nextNumber = useGetNextAllotmentNumberQuery({ fiscalYear: fy }, { skip: !!editing });
  const options = useMemo(() => appropriations.data?.items.filter((a) => a.status !== "Draft") ?? [], [appropriations.data]);
  const app = options.find((a) => a.referenceNo === values.appropriationRef);
  // When editing, this allotment's saved amount is already counted in `allotted`.
  const remaining = app ? app.amount - app.allotted + (editing && editing.appropriationRef === app.referenceNo && editing.status !== "Draft" ? editing.amount : 0) : null;
  schemaRef.current = useMemo(() => registryAllotmentSchema(remaining, config.scheduleFields), [remaining, config.scheduleFields]);

  const lines = values.lineItems ?? [];
  const lineAmount = (li: Partial<RegistryAllotmentValues["lineItems"][number]>) =>
    Number.isFinite(li?.quantity) && Number.isFinite(li?.unitCost) ? Number(li.quantity) * Number(li.unitCost) : 0;
  const total = lines.reduce((s, li) => s + lineAmount(li), 0);
  const totalQty = lines.reduce((s, li) => s + (Number.isFinite(li.quantity) ? Number(li.quantity) : 0), 0);

  // Defaults from the reference appropriation.
  const lastApp = useRef(editing?.appropriationRef ?? "");
  useEffect(() => {
    if (!app || lastApp.current === app.referenceNo) return;
    lastApp.current = app.referenceNo;
    setValue("fundSource", app.fundSource);
    if (!getValues("uacsCode")) setValue("uacsCode", app.uacsCode);
    if (!getValues("gaaReferenceNo")) setValue("gaaReferenceNo", app.gaaReference);
  }, [app, setValue, getValues]);

  const uacsInfo = appLookups.data?.uacsCodes.find((u) => u.code === values.uacsCode?.trim());
  const lookupUacs = () => setUacsHint(values.uacsCode && !uacsInfo ? "Not in the eBudget UACS list. Check the code." : null);

  const toInput = (v: Partial<RegistryAllotmentValues>): RegistryAllotmentInput => ({
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
    effectivityDate: config.scheduleFields ? v.effectivityDate : undefined,
    validityDate: config.scheduleFields ? v.validityDate : undefined,
  });

  const save = async (v: Partial<RegistryAllotmentValues>, intent: "draft" | "submit") => {
    setPending(intent);
    try {
      const input = toInput(v);
      const record = editing ? await update({ id: editing.id, ...input }).unwrap() : await create(input).unwrap();
      if (intent === "draft") {
        notify("success", "Draft saved", `${record.allotmentNo} was saved as a draft.`);
        router.push(ROUTES.allotmentClass(meta.slug));
      } else {
        notify("success", "Allotment saved", `Review ${record.allotmentNo} and submit it for approval.`);
        router.push(ROUTES.classAllotment(meta.slug, record.id));
      }
    } catch (err) {
      applyServerErrors(err, setError);
    } finally {
      setPending(null);
    }
  };

  const onSubmit = handleSubmit((v) => save(v, "submit"));
  const onDraft = () => {
    if (!getValues("appropriationRef")) {
      setError("appropriationRef", { message: "Select the reference appropriation to save a draft" });
      return;
    }
    void save(getValues(), "draft");
  };

  if (lookups.isLoading || appropriations.isLoading) {
    return (
      <>
        <PageHeader title={`New ${meta.code} Allotment`} extraCrumbs={["New Allotment"]} />
        <Skeleton className="h-[640px] w-full rounded-xl" />
      </>
    );
  }

  const err = (n: keyof RegistryAllotmentValues) => errors[n]?.message as string | undefined;
  const inv = (n: keyof RegistryAllotmentValues) => ({ invalid: !!errors[n], "aria-describedby": errors[n] ? `${n}-error` : undefined });
  const row = "grid grid-cols-1 gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start sm:gap-3";
  const lbl = "pt-2 text-sm font-medium text-blue-900";
  const req = <span className="text-brand-600">*</span>;

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${editing.allotmentNo}` : `New ${meta.code} Allotment`}
        description={`${editing ? "Update the allotment" : "Create a new allotment"} under ${meta.code} (${meta.expenseClass}).`}
        extraCrumbs={[editing ? editing.allotmentNo : "New Allotment"]}
      />
      {editing?.status === "Returned" && (
        <div className="mb-5"><FormAlert>Returned for revision: {editing.workflow.find((s) => s.status === "returned")?.remarks ?? "see the approval history."}</FormAlert></div>
      )}
      {saveError && !Object.keys(errors).length && <div className="mb-5"><FormAlert>{getErrorMessage(saveError)}</FormAlert></div>}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className={cn(config.scheduleFields && "grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="min-w-0 space-y-5">
        <Card>
          <Head
            icon={Shield}
            title="Allotment Information"
            action={
              <span className="flex items-center gap-3">
                <span className="rounded-lg bg-red-100 px-3 py-1 text-base font-bold text-brand-600">{meta.code}</span>
                <span className="hidden text-sm text-blue-900 md:inline">{meta.expenseClass}</span>
              </span>
            }
          />
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 p-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className={row}>
                <label htmlFor="allotmentNo" className={lbl}>Allotment No.</label>
                <Input id="allotmentNo" readOnly value={editing?.allotmentNo ?? nextNumber.data?.allotmentNo ?? ""} className="bg-gray-50" rightSlot={<span className="px-2 text-blue-600" title="Assigned automatically when saved"><Info className="size-4" aria-hidden /></span>} />
              </div>
              <div className={row}>
                <label htmlFor="fiscalYear" className={lbl}>Fiscal Year {req}</label>
                <Select id="fiscalYear" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: `FY ${y}` }))} {...register("fiscalYear", { valueAsNumber: true, onChange: () => setValue("appropriationRef", "") })} />
              </div>
              <div className={row}>
                <label htmlFor="tranche" className={lbl}>Tranche {req}</label>
                <Select id="tranche" options={toOptions(TRANCHE_TYPES)} {...register("tranche")} />
              </div>
              <div className={row}>
                <label htmlFor="date" className={lbl}>Date of Allotment {req}</label>
                <FormField label="" htmlFor="date" error={err("date")}><Input id="date" type="date" {...inv("date")} {...register("date")} /></FormField>
              </div>
              <div className={row}>
                <label htmlFor="appropriationRef" className={lbl}>Reference Document {req}</label>
                <FormField label="" htmlFor="appropriationRef" error={err("appropriationRef")} hint={remaining !== null ? `Unallotted balance: ${formatCurrency(remaining)}` : `${meta.code} appropriations for FY ${fy}`}>
                  <Select id="appropriationRef" placeholder="Select appropriation" options={options.map((a) => ({ value: a.referenceNo, label: `${a.gaaReference || `GAA ${a.fiscalYear}`} · ${a.referenceNo} · ${a.title}` }))} {...inv("appropriationRef")} {...register("appropriationRef")} />
                </FormField>
              </div>
              <div className={row}>
                <label htmlFor="gaaReferenceNo" className={lbl}>GAA Reference No. {req}</label>
                <FormField label="" htmlFor="gaaReferenceNo" error={err("gaaReferenceNo")}><Input id="gaaReferenceNo" placeholder="e.g. GAA-2026-0012" {...inv("gaaReferenceNo")} {...register("gaaReferenceNo")} /></FormField>
              </div>
              <div className={row}>
                <label htmlFor="department" className={lbl}>Department/Office {req}</label>
                <FormField label="" htmlFor="department" error={err("department")}>
                  <Select id="department" placeholder="Select department/office" options={(lookups.data?.departments ?? []).map((d) => ({ value: d, label: d }))} {...inv("department")} {...register("department")} />
                </FormField>
              </div>
              <div className={row}>
                <label htmlFor="responsibilityCenter" className={lbl}>Responsibility Center</label>
                <Input id="responsibilityCenter" placeholder={values.department || "Same as department"} {...register("responsibilityCenter")} />
              </div>
            </div>
            <div className="space-y-3">
              <div className={row}>
                <label htmlFor="cls" className={lbl}>Allotment Class</label>
                <Input id="cls" readOnly value={`${meta.code} - ${meta.expenseClass}`} className="bg-gray-100 text-gray-600" />
              </div>
              <div className={row}>
                <label htmlFor="fundSource" className={lbl}>Funding Source {req}</label>
                <FormField label="" htmlFor="fundSource" error={err("fundSource")}>
                  <Select id="fundSource" placeholder="Select funding source" options={appLookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []} {...inv("fundSource")} {...register("fundSource")} />
                </FormField>
              </div>
              <div className={row}>
                <label htmlFor="uacsCode" className={lbl}>UACS {req}</label>
                <FormField label="" htmlFor="uacsCode" error={err("uacsCode")} hint={uacsHint ?? undefined}>
                  <div className="flex">
                    <Input id="uacsCode" inputMode="numeric" leftIcon={<Search className="size-4" />} className="rounded-r-none" {...inv("uacsCode")} {...register("uacsCode", { onBlur: lookupUacs })} />
                    <button type="button" onClick={lookupUacs} className="flex w-10 shrink-0 items-center justify-center rounded-r-lg bg-blue-600 text-white hover:bg-blue-700" aria-label="Look up UACS code">
                      <Search className="size-4" />
                    </button>
                  </div>
                  <dl className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3 text-xs">
                    <div className="grid grid-cols-[7rem_1fr] gap-2"><dt className="text-gray-500">UACS Description</dt><dd className="text-gray-900">{uacsInfo?.description ?? "—"}</dd></div>
                    <div className="grid grid-cols-[7rem_1fr] gap-2"><dt className="text-gray-500">Expense Class</dt><dd className="text-gray-900">{meta.expenseClass}</dd></div>
                  </dl>
                </FormField>
              </div>
              <div className={row}>
                <label htmlFor="purpose" className={lbl}>Particulars / Description {req}</label>
                <FormField label="" htmlFor="purpose" error={err("purpose")}><Textarea id="purpose" rows={2} className="min-h-16" maxLength={500} {...inv("purpose")} {...register("purpose")} /></FormField>
              </div>
              <div className={row}>
                <label htmlFor="remarks" className={lbl}>Remarks</label>
                <div>
                  <Textarea id="remarks" rows={2} className="min-h-16" maxLength={500} {...register("remarks")} />
                  <p className="text-right text-xs text-gray-500">{(values.remarks ?? "").length}/500</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <Head icon={ListChecks} title="Allotment Line Items" action={<Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => append({ ...emptyLine })}><Plus className="size-4" /> Add Line Item</Button>} />
          {(errors.lineItems?.message || errors.lineItems?.root?.message) && (
            <p className="px-5 pt-3 text-sm text-red-600" role="alert">{errors.lineItems?.message ?? errors.lineItems?.root?.message}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">Allotment line items</caption>
              <thead>
                <tr className="bg-gray-50 text-left text-gray-700">
                  <th scope="col" className="w-10 px-2 py-2.5 pl-5">#</th>
                  <th scope="col" className="px-2 py-2.5">UACS Code {req}</th>
                  <th scope="col" className="px-2 py-2.5">Particulars / Description {req}</th>
                  <th scope="col" className="w-20 px-2 py-2.5">Qty</th>
                  <th scope="col" className="w-24 px-2 py-2.5">Unit</th>
                  <th scope="col" className="w-28 px-2 py-2.5">Unit Cost (₱)</th>
                  <th scope="col" className="w-32 px-2 py-2.5 text-right">Amount (₱)</th>
                  <th scope="col" className="px-2 py-2.5">Remarks</th>
                  <th scope="col" className="w-14 px-2 py-2.5 pr-5 text-center">Actions</th>
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
                      <td className="px-2 py-2">
                        <select aria-label={`Line ${i + 1} unit`} className={cell(e?.unit)} {...register(`lineItems.${i}.unit`)}>
                          {(oblLookups.data?.units ?? ["piece"]).map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2"><input aria-label={`Line ${i + 1} unit cost`} type="number" min={0} step="0.01" className={cn(cell(e?.unitCost), "text-right")} {...register(`lineItems.${i}.unitCost`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-2 pt-4 text-right tabular-nums">{formatCurrency(lineAmount(lines[i] ?? {})).replace("₱", "")}</td>
                      <td className="px-2 py-2"><input aria-label={`Line ${i + 1} remarks`} className={cell()} {...register(`lineItems.${i}.remarks`)} /></td>
                      <td className="px-2 py-2 pr-5 text-center">
                        <button type="button" onClick={() => remove(i)} disabled={fields.length === 1} className="rounded p-2 text-brand-600 hover:bg-red-50 disabled:opacity-30" aria-label={`Remove line ${i + 1}`}><Trash2 className="size-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} />
                  <td colSpan={2} className="bg-blue-50 px-3 py-3"><span className="flex justify-between font-semibold">Total Amount (₱) <span className="tabular-nums">{formatCurrency(total).replace("₱", "")}</span></span></td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        </div>
        {config.scheduleFields && (
          <aside className="min-w-0 space-y-5" aria-label="Allotment summary, schedule and workflow">
            <Card>
              <Head icon={BarChart3} title="Allotment Summary" />
              <dl className="space-y-2 p-5 text-sm">
                {[
                  ["Total Allotment Amount (₱)", total],
                  ["Total Obligations (₱)", 0],
                  ["Total Disbursements (₱)", 0],
                  ["Available Balance (₱)", total],
                ].map(([k, v]) => (
                  <div key={k as string} className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-2">
                    <dt className="text-blue-900">{k}</dt>
                    <dd className="rounded-md bg-blue-50 px-3 py-1.5 text-right font-semibold tabular-nums">{formatCurrency(Number(v)).replace("₱", "")}</dd>
                  </div>
                ))}
                {remaining !== null && <p className="pt-1 text-xs text-gray-500">Appropriation balance after this allotment: {formatCurrency(remaining - total)}</p>}
              </dl>
            </Card>
            <Card>
              <Head icon={Info} title="Schedule / Validity" />
              <div className="space-y-3 p-5">
                <FormField label="Effectivity Date" htmlFor="effectivityDate" required error={err("effectivityDate")}>
                  <Input id="effectivityDate" type="date" {...inv("effectivityDate")} {...register("effectivityDate")} />
                </FormField>
                <FormField label="Validity Date" htmlFor="validityDate" required error={err("validityDate")}>
                  <Input id="validityDate" type="date" {...inv("validityDate")} {...register("validityDate")} />
                </FormField>
              </div>
            </Card>
            <Card>
              <Head icon={ListChecks} title="Workflow" />
              <ol className="space-y-3 p-5 text-sm">
                {(["submit", "review", "accountant", "certification"] as const).map((k, i) => (
                  <li key={k} className="flex gap-3">
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", i === 0 ? "bg-blue-600" : "bg-gray-400")}>{i + 1}</span>
                    <span>
                      <span className="block font-medium text-blue-900">{REGISTRY_STEP_LABELS[k]}</span>
                      <span className="text-xs text-gray-500">{i === 0 ? "By: Budget Officer (you)" : lookups.data?.approvers.find((x) => x.step === k)?.label}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
            <Card>
              <Head icon={Paperclip} title="Supporting Documents" />
              <div className="p-5"><DocumentsField compact documents={documents} onChange={setDocuments} upload={(file) => uploadDoc(file).unwrap()} /></div>
            </Card>
          </aside>
        )}
        </div>

        {!config.scheduleFields && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <Head icon={Paperclip} title="Supporting Documents" />
            <div className="p-5"><DocumentsField documents={documents} onChange={setDocuments} upload={(file) => uploadDoc(file).unwrap()} /></div>
          </Card>
          <Card>
            <Head icon={BarChart3} title="Summary" />
            <dl className="space-y-1 p-5 text-sm">
              <div className="flex justify-between py-1.5"><dt className="text-gray-600">Total Items</dt><dd className="font-semibold">{fields.length}</dd></div>
              <div className="flex justify-between py-1.5"><dt className="text-gray-600">Total Quantity</dt><dd className="font-semibold tabular-nums">{totalQty.toLocaleString("en-PH")}</dd></div>
              <div className="flex justify-between rounded-lg bg-blue-50 px-3 py-2"><dt className="font-medium text-blue-900">Total Amount (₱)</dt><dd className="text-lg font-bold tabular-nums text-blue-900">{formatCurrency(total).replace("₱", "")}</dd></div>
              <div className="flex justify-between py-1.5">
                <dt className="text-gray-600">Remaining after this allotment</dt>
                <dd className={cn("font-semibold tabular-nums", remaining !== null && remaining - total < 0 && "text-red-600")}>{remaining !== null ? formatCurrency(remaining - total) : "—"}</dd>
              </div>
            </dl>
          </Card>
        </div>
        )}

        <div className="sticky bottom-0 z-20 -mx-4 border-t border-gray-200 bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap justify-between gap-3">
            <Link href={editing ? ROUTES.classAllotment(meta.slug, editing.id) : ROUTES.allotmentClass(meta.slug)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ChevronLeft className="size-4" /> {editing ? "Back to Details" : config.scheduleFields ? "Back to List" : `Back to ${meta.code} Allotments`}
            </Link>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="lg" onClick={onDraft} loading={pending === "draft"} disabled={saving}>{pending !== "draft" && <Save className="size-4" />} Save as Draft</Button>
              <Button type="submit" size="lg" loading={pending === "submit"} disabled={saving}>{pending !== "submit" && <Send className="size-4" />} Submit for Approval</Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
