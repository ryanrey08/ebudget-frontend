"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BarChart3,
  Check,
  FileText,
  FolderOpen,
  ListChecks,
  Paperclip,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
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
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { getAllotmentClass } from "@/lib/constants/allotment-classes";
import { toOptions } from "@/lib/constants/options";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { useGetAppropriationLookupsQuery } from "@/features/appropriations/services/appropriationsApi";
import { useGetAllotmentsQuery } from "@/features/allotments/services/allotmentsApi";
import { TRANCHE_TYPES } from "@/features/allotments/types";
import {
  useCreateObligationMutation,
  useGetNextObligationNumberQuery,
  useGetObligationLookupsQuery,
  useUpdateObligationMutation,
  useUploadObligationDocumentMutation,
} from "../services/obligationsApi";
import { lineTotal, obligationFormSchema, type ObligationFormValues } from "../schemas";
import type { ObligationDetail, ObligationDocument, ObligationInput, ProcurementSource } from "../types";
import { ImportSourceModal } from "./ImportSourceModal";

const emptyLine = { uacsCode: "", description: "", quantity: 1, unit: "piece", unitCost: Number.NaN };

function CardHead({ icon: Icon, title, action }: { icon: typeof FileText; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Icon className="size-5 text-brand-600" aria-hidden /> {title}
      </h2>
      {action}
    </div>
  );
}

/** New Obligation and Edit Obligation (drafts and returned records). */
export function ObligationForm({ existing }: { existing?: ObligationDetail }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const fiscalYear = useFiscalYear();
  const editing = existing?.obligation;
  const lookups = useGetObligationLookupsQuery();
  const appLookups = useGetAppropriationLookupsQuery();
  const allotments = useGetAllotmentsQuery({ fiscalYear: editing?.fiscalYear ?? fiscalYear, pageSize: 100 });
  const nextNumber = useGetNextObligationNumberQuery({ fiscalYear }, { skip: !!editing });
  const [uploadDoc] = useUploadObligationDocumentMutation();
  const [create, createState] = useCreateObligationMutation();
  const [update, updateState] = useUpdateObligationMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const saveError = createState.error ?? updateState.error;
  const [documents, setDocuments] = useState<ObligationDocument[]>(editing?.documents ?? []);
  const [importType, setImportType] = useState<ProcurementSource["type"] | null>(searchParams.get("import") === "pr" ? "PR/PO" : null);
  const [pendingAction, setPendingAction] = useState<"draft" | "submit" | null>(null);

  const schemaRef = useRef(obligationFormSchema(null));
  const form = useForm<ObligationFormValues>({
    resolver: (values, ctx, opts) => zodResolver(schemaRef.current)(values, ctx, opts),
    mode: "onTouched",
    defaultValues: editing
      ? {
          ...editing,
          date: editing.date.slice(0, 10),
          lineItems: editing.lineItems.map(({ uacsCode, description, quantity, unit, unitCost }) => ({ uacsCode, description, quantity, unit, unitCost })),
        }
      : {
          date: new Date().toISOString().slice(0, 10),
          allotmentRef: "",
          tranche: "1st Tranche",
          fundSource: "",
          responsibilityCenter: "",
          payee: "",
          tin: "",
          address: "",
          particulars: "",
          lineItems: [{ ...emptyLine }],
          appNo: "",
          prNo: "",
          poNo: "",
          modeOfProcurement: "",
          projectActivity: "",
          remarks: "",
          applicableDocuments: ["Approved Allotment"],
        },
  });
  const { control, register, setValue, getValues, handleSubmit, setError, formState } = form;
  const { fields, append, remove, replace } = useFieldArray({ control, name: "lineItems" });
  const values = useWatch({ control }) as Partial<ObligationFormValues>;
  const errors = formState.errors;

  const allotmentOptions = useMemo(
    () => allotments.data?.items.filter((a) => a.status === "Released" || a.status === "Partial") ?? [],
    [allotments.data],
  );
  const allotment = allotmentOptions.find((a) => a.allotmentNo === values.allotmentRef);
  // When editing, the saved amount of this obligation is already inside `obligated`.
  const others = allotment
    ? editing && existing?.allotment && existing.allotment.allotmentNo === allotment.allotmentNo
      ? existing.allotment.otherObligations
      : allotment.obligated
    : 0;
  const total = lineTotal(values.lineItems as ObligationFormValues["lineItems"]);
  const remainingBefore = allotment ? allotment.amount - others : null;
  schemaRef.current = useMemo(() => obligationFormSchema(remainingBefore), [remainingBefore]);

  // Default tranche and fund source from the chosen allotment.
  const lastAllotment = useRef(editing?.allotmentRef ?? "");
  useEffect(() => {
    if (!allotment || lastAllotment.current === allotment.allotmentNo) return;
    lastAllotment.current = allotment.allotmentNo;
    setValue("fundSource", allotment.fundSource);
    setValue("tranche", allotment.tranche);
    if (!getValues("responsibilityCenter")) setValue("responsibilityCenter", allotment.program);
  }, [allotment, setValue, getValues]);

  const pickPayee = (name: string) => {
    const p = lookups.data?.payees.find((x) => x.name === name);
    if (!p) return;
    if (!getValues("tin")) setValue("tin", p.tin);
    if (!getValues("address")) setValue("address", p.address);
  };

  const importSource = (s: ProcurementSource) => {
    replace(s.items.map((i) => ({ ...i })));
    if (s.appNo) setValue("appNo", s.appNo);
    if (s.prNo) setValue("prNo", s.prNo);
    if (s.poNo) setValue("poNo", s.poNo);
    if (s.modeOfProcurement) setValue("modeOfProcurement", s.modeOfProcurement);
    setValue("projectActivity", s.title);
    if (s.payee && !getValues("payee")) {
      setValue("payee", s.payee);
      pickPayee(s.payee);
    }
    if (!getValues("particulars")) setValue("particulars", s.title);
    const docs = new Set(getValues("applicableDocuments"));
    if (s.appNo) docs.add("APP");
    if (s.prNo) docs.add("Purchase Request (PR)");
    if (s.poNo) docs.add("Purchase Order (PO)");
    setValue("applicableDocuments", [...docs]);
    setImportType(null);
    notify("success", "Items imported", `${s.items.length} line items from ${s.referenceNo}.`);
  };

  const toInput = (v: Partial<ObligationFormValues>): ObligationInput => ({
    date: v.date ?? "",
    allotmentRef: v.allotmentRef ?? "",
    tranche: v.tranche ?? "1st Tranche",
    fundSource: v.fundSource ?? "",
    responsibilityCenter: v.responsibilityCenter ?? "",
    payee: v.payee ?? "",
    tin: v.tin ?? "",
    address: v.address ?? "",
    particulars: v.particulars ?? "",
    lineItems: (v.lineItems ?? [])
      .filter((li) => li.uacsCode || li.description)
      .map((li) => ({
        uacsCode: li.uacsCode ?? "",
        description: li.description ?? "",
        quantity: Number.isFinite(li.quantity) ? Number(li.quantity) : 0,
        unit: li.unit ?? "",
        unitCost: Number.isFinite(li.unitCost) ? Number(li.unitCost) : 0,
      })),
    appNo: v.appNo ?? "",
    prNo: v.prNo ?? "",
    poNo: v.poNo ?? "",
    modeOfProcurement: v.modeOfProcurement ?? "",
    projectActivity: v.projectActivity ?? "",
    remarks: v.remarks ?? "",
    applicableDocuments: v.applicableDocuments ?? [],
    documentIds: documents.map((d) => d.id),
  });

  const save = async (v: Partial<ObligationFormValues>, intent: "draft" | "submit") => {
    setPendingAction(intent);
    try {
      const input = toInput(v);
      const record = editing ? await update({ id: editing.id, ...input }).unwrap() : await create(input).unwrap();
      if (intent === "draft") {
        notify("success", "Draft saved", `${record.referenceNo} was saved as a draft.`);
        router.push(ROUTES.obligationManagement);
      } else {
        notify("success", "Obligation saved", `Review ${record.referenceNo} and submit it for approval.`);
        router.push(ROUTES.obligation(record.id));
      }
    } catch (err) {
      applyServerErrors(err, setError);
    } finally {
      setPendingAction(null);
    }
  };

  const onSubmit = handleSubmit((v) => save(v, "submit"));
  const onDraft = () => {
    if (!getValues("allotmentRef")) {
      setError("allotmentRef", { message: "Select an allotment to save a draft" });
      return;
    }
    void save(getValues(), "draft");
  };
  const onCancel = () => {
    if ((formState.isDirty || documents.length !== (editing?.documents.length ?? 0)) && !window.confirm("Discard your changes?")) return;
    router.push(editing ? ROUTES.obligation(editing.id) : ROUTES.obligationManagement);
  };

  const err = (n: keyof ObligationFormValues) => errors[n]?.message as string | undefined;
  const inv = (n: keyof ObligationFormValues) => ({ invalid: !!errors[n], "aria-describedby": errors[n] ? `${n}-error` : undefined });
  const row = "grid grid-cols-1 gap-1.5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start sm:gap-3";
  const lbl = "pt-2 text-sm font-medium text-gray-700";
  const reqMark = <span className="text-brand-600">*</span>;

  if (lookups.isLoading || allotments.isLoading) {
    return (
      <>
        <PageHeader title={editing ? "Edit Obligation" : "New Obligation"} extraCrumbs={[editing ? editing.referenceNo : "New Obligation"]} />
        <Skeleton className="h-[640px] w-full rounded-xl" />
      </>
    );
  }

  const cls = allotment ? getAllotmentClass(allotment.allotmentClass) : undefined;

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${editing.referenceNo}` : "New Obligation"}
        description={editing ? "Update the obligation and resubmit it for approval." : "Encode a new obligation against an approved allotment."}
        extraCrumbs={[editing ? "Edit" : "New Obligation"]}
      />
      {editing?.status === "Returned" && (
        <div className="mb-5">
          <FormAlert>
            Returned for revision: {editing.workflow.find((s) => s.status === "returned")?.remarks ?? "see the approval history."}
          </FormAlert>
        </div>
      )}
      {saveError && !Object.keys(errors).length && (
        <div className="mb-5"><FormAlert>{getErrorMessage(saveError)}</FormAlert></div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <Card>
              <CardHead icon={FileText} title="Basic Information" />
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 pb-5 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className={row}>
                    <label htmlFor="refNo" className={lbl}>Obligation No.</label>
                    <div className="flex">
                      <Input id="refNo" readOnly value={editing?.referenceNo ?? nextNumber.data?.referenceNo ?? ""} className="rounded-r-none bg-gray-50" />
                      <span className="flex items-center rounded-r-lg border border-l-0 border-gray-300 bg-gray-100 px-3 text-xs whitespace-nowrap text-gray-600">Auto-generated</span>
                    </div>
                  </div>
                  <div className={row}>
                    <label htmlFor="date" className={lbl}>Obligation Date {reqMark}</label>
                    <FormField label="" htmlFor="date" error={err("date")}><Input id="date" type="date" {...inv("date")} {...register("date")} /></FormField>
                  </div>
                  <div className={row}>
                    <label htmlFor="allotmentRef" className={lbl}>Allotment No. {reqMark}</label>
                    <FormField label="" htmlFor="allotmentRef" error={err("allotmentRef")}>
                      <Select
                        id="allotmentRef"
                        placeholder="Select released allotment"
                        options={allotmentOptions.map((a) => ({ value: a.allotmentNo, label: `${a.allotmentNo} · ${a.allotmentClass} · ${a.objectOfExpenditure}` }))}
                        {...inv("allotmentRef")}
                        {...register("allotmentRef")}
                      />
                    </FormField>
                  </div>
                  <div className={row}>
                    <label htmlFor="clsDisplay" className={lbl}>Allotment Class</label>
                    <Input id="clsDisplay" readOnly value={cls ? `${cls.code} - ${cls.expenseClass}` : ""} placeholder="—" className="bg-gray-100 text-gray-600" />
                  </div>
                  <div className={row}>
                    <label htmlFor="tranche" className={lbl}>Tranche {reqMark}</label>
                    <Select id="tranche" options={toOptions(TRANCHE_TYPES)} {...register("tranche")} />
                  </div>
                  <div className={row}>
                    <label htmlFor="fundSource" className={lbl}>Fund Source {reqMark}</label>
                    <FormField label="" htmlFor="fundSource" error={err("fundSource")}>
                      <Select id="fundSource" placeholder="Select fund source" options={appLookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []} {...inv("fundSource")} {...register("fundSource")} />
                    </FormField>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className={row}>
                    <label htmlFor="responsibilityCenter" className={lbl}>Responsibility Center {reqMark}</label>
                    <FormField label="" htmlFor="responsibilityCenter" error={err("responsibilityCenter")}>
                      <Select id="responsibilityCenter" placeholder="Select responsibility center" options={appLookups.data?.programs.map((p) => ({ value: p, label: p })) ?? []} {...inv("responsibilityCenter")} {...register("responsibilityCenter")} />
                    </FormField>
                  </div>
                  <div className={row}>
                    <label htmlFor="payee" className={lbl}>Payee/Supplier {reqMark}</label>
                    <FormField label="" htmlFor="payee" error={err("payee")}>
                      <Input id="payee" list="payee-options" placeholder="Type or pick a payee" leftIcon={<Search className="size-4" />} {...inv("payee")} {...register("payee", { onChange: (e) => pickPayee(e.target.value) })} />
                      <datalist id="payee-options">
                        {lookups.data?.payees.map((p) => <option key={p.name} value={p.name} />)}
                      </datalist>
                    </FormField>
                  </div>
                  <div className={row}>
                    <label htmlFor="tin" className={lbl}>TIN</label>
                    <Input id="tin" placeholder="000-000-000-000" {...register("tin")} />
                  </div>
                  <div className={row}>
                    <label htmlFor="address" className={lbl}>Address</label>
                    <Textarea id="address" rows={2} className="min-h-16" {...register("address")} />
                  </div>
                  <div className={row}>
                    <label htmlFor="particulars" className={lbl}>Particulars {reqMark}</label>
                    <FormField label="" htmlFor="particulars" error={err("particulars")}>
                      <Textarea id="particulars" rows={2} className="min-h-16" maxLength={500} {...inv("particulars")} {...register("particulars")} />
                    </FormField>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <CardHead
                icon={ListChecks}
                title="Obligation Details"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => append({ ...emptyLine })}><Plus className="size-4" /> Add Item</Button>
                    <Button variant="outline" size="sm" onClick={() => setImportType("PR/PO")}><Plus className="size-4" /> Import from PR/PO</Button>
                    <Button variant="outline" size="sm" onClick={() => setImportType("APP")}>Import from APP</Button>
                  </div>
                }
              />
              {errors.lineItems?.message && <p className="px-5 pb-2 text-sm text-red-600" role="alert">{errors.lineItems.message}</p>}
              {errors.lineItems?.root?.message && <p className="px-5 pb-2 text-sm text-red-600" role="alert">{errors.lineItems.root.message}</p>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <caption className="sr-only">Obligation line items</caption>
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-700">
                      <th scope="col" className="w-10 px-2 py-2.5 pl-5 font-semibold">#</th>
                      <th scope="col" className="px-2 py-2.5 font-semibold">UACS Code {reqMark}</th>
                      <th scope="col" className="px-2 py-2.5 font-semibold">Particulars / Description {reqMark}</th>
                      <th scope="col" className="w-24 px-2 py-2.5 font-semibold">Quantity</th>
                      <th scope="col" className="w-28 px-2 py-2.5 font-semibold">Unit</th>
                      <th scope="col" className="w-32 px-2 py-2.5 font-semibold">Unit Cost (₱)</th>
                      <th scope="col" className="w-36 px-2 py-2.5 text-right font-semibold">Amount (₱)</th>
                      <th scope="col" className="w-16 px-2 py-2.5 pr-5 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fields.map((f, i) => {
                      const li = values.lineItems?.[i];
                      const amount = li && Number.isFinite(li.quantity) && Number.isFinite(li.unitCost) ? Number(li.quantity) * Number(li.unitCost) : 0;
                      const e = errors.lineItems?.[i];
                      const cell = (bad?: unknown) => cn(fieldClasses, "h-9 px-2", !!bad && "border-red-400");
                      return (
                        <tr key={f.id} className="align-top">
                          <td className="px-2 py-2 pl-5 pt-4 text-gray-600">{i + 1}</td>
                          <td className="px-2 py-2">
                            <input aria-label={`Line ${i + 1} UACS code`} inputMode="numeric" className={cell(e?.uacsCode)} {...register(`lineItems.${i}.uacsCode`)} />
                            {e?.uacsCode && <p className="mt-1 text-xs text-red-600">{e.uacsCode.message}</p>}
                          </td>
                          <td className="px-2 py-2">
                            <input aria-label={`Line ${i + 1} description`} className={cell(e?.description)} {...register(`lineItems.${i}.description`)} />
                            {e?.description && <p className="mt-1 text-xs text-red-600">{e.description.message}</p>}
                          </td>
                          <td className="px-2 py-2">
                            <input aria-label={`Line ${i + 1} quantity`} type="number" min={0} step="any" className={cn(cell(e?.quantity), "text-right")} {...register(`lineItems.${i}.quantity`, { valueAsNumber: true })} />
                          </td>
                          <td className="px-2 py-2">
                            <select aria-label={`Line ${i + 1} unit`} className={cell(e?.unit)} {...register(`lineItems.${i}.unit`)}>
                              {lookups.data?.units.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input aria-label={`Line ${i + 1} unit cost`} type="number" min={0} step="0.01" className={cn(cell(e?.unitCost), "text-right")} {...register(`lineItems.${i}.unitCost`, { valueAsNumber: true })} />
                          </td>
                          <td className="px-2 py-2 pt-4 text-right tabular-nums">{formatCurrency(amount).replace("₱", "")}</td>
                          <td className="px-2 py-2 pr-5 text-center">
                            <button type="button" onClick={() => remove(i)} disabled={fields.length === 1} className="rounded p-2 text-brand-600 hover:bg-red-50 disabled:opacity-30" aria-label={`Remove line ${i + 1}`}>
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} />
                      <td colSpan={3} className="bg-blue-50 px-3 py-3 pr-5">
                        <span className="flex justify-between font-semibold text-gray-900">
                          Total Amount (₱) <span className="tabular-nums">{formatCurrency(total).replace("₱", "")}</span>
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>

          <aside className="min-w-0 space-y-5" aria-label="Allotment balance and applicable documents">
            <Card>
              <CardHead icon={BarChart3} title="Allotment Balance" />
              <dl className="space-y-1 px-5 pb-5 text-sm">
                {[
                  ["Allotment No.", allotment?.allotmentNo ?? "—"],
                  ["Allotment Amount", allotment ? formatCurrency(allotment.amount) : "—"],
                  ["Total Obligations", allotment ? formatCurrency(others) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 py-1.5"><dt className="text-gray-600">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
                ))}
                <div className="flex justify-between gap-2 rounded-lg bg-blue-50 px-2 py-1.5"><dt className="font-medium text-blue-900">Current Obligation</dt><dd className="font-bold tabular-nums text-blue-900">{formatCurrency(total)}</dd></div>
                <div className="flex justify-between gap-2 py-1.5">
                  <dt className="text-gray-600">Remaining Balance</dt>
                  <dd className={cn("font-semibold tabular-nums", remainingBefore !== null && remainingBefore - total < 0 && "text-red-600")}>
                    {remainingBefore !== null ? formatCurrency(remainingBefore - total) : "—"}
                  </dd>
                </div>
              </dl>
            </Card>
            <Card>
              <CardHead icon={Paperclip} title="Applicable Documents" />
              <Controller
                control={control}
                name="applicableDocuments"
                render={({ field }) => (
                  <fieldset className="space-y-2.5 px-5 pb-5">
                    <legend className="sr-only">Applicable documents</legend>
                    {lookups.data?.applicableDocuments.map((d) => (
                      <label key={d} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="size-[18px] accent-blue-600"
                          checked={field.value?.includes(d) ?? false}
                          onChange={(e) => field.onChange(e.target.checked ? [...(field.value ?? []), d] : (field.value ?? []).filter((x) => x !== d))}
                        />
                        {d}
                      </label>
                    ))}
                  </fieldset>
                )}
              />
            </Card>
          </aside>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card>
            <CardHead icon={FolderOpen} title="Reference Documents" />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
              <FormField label="APP No." htmlFor="appNo"><Input id="appNo" {...register("appNo")} /></FormField>
              <FormField label="PR No." htmlFor="prNo"><Input id="prNo" {...register("prNo")} /></FormField>
              <FormField label="PO No." htmlFor="poNo"><Input id="poNo" {...register("poNo")} /></FormField>
              <FormField label="Mode of Procurement" htmlFor="modeOfProcurement">
                <Select id="modeOfProcurement" placeholder="Select mode" options={toOptions(lookups.data?.modesOfProcurement ?? [])} {...register("modeOfProcurement")} />
              </FormField>
              <FormField label="Project/Activity" htmlFor="projectActivity" className="sm:col-span-2"><Input id="projectActivity" {...register("projectActivity")} /></FormField>
              <FormField label="Remarks" htmlFor="remarks" error={err("remarks")} className="sm:col-span-2"><Textarea id="remarks" rows={2} maxLength={500} {...register("remarks")} /></FormField>
            </div>
          </Card>
          <Card>
            <CardHead icon={Paperclip} title={`Attachments (${documents.length})`} />
            <div className="px-5 pb-5">
              <DocumentsField documents={documents} onChange={setDocuments} upload={(file) => uploadDoc(file).unwrap()} />
            </div>
          </Card>
        </div>

        <div className="sticky bottom-0 z-20 -mx-4 border-t border-gray-200 bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" size="lg" onClick={onCancel} disabled={saving}><X className="size-4" /> Cancel</Button>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="lg" onClick={onDraft} loading={pendingAction === "draft"} disabled={saving}>
                {pendingAction !== "draft" && <Save className="size-4" />} Save as Draft
              </Button>
              <Button type="submit" size="lg" loading={pendingAction === "submit"} disabled={saving}>
                {pendingAction !== "submit" && <Check className="size-4" />} Submit for Approval
              </Button>
            </div>
          </div>
        </div>
      </form>

      <ImportSourceModal type={importType} sources={lookups.data?.sources ?? []} onClose={() => setImportType(null)} onImport={importSource} />
    </>
  );
}
