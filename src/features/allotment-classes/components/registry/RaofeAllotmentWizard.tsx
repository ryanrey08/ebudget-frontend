"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronDown, ChevronRight, CloudUpload, Copy, Download, FileText, Folder, Info,
  Landmark, ListChecks, NotebookPen, Paperclip, Plus, Save, Search, Send, ShieldCheck, Trash2, Upload, Wallet, X, XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, fieldClasses } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { applyServerErrors } from "@/components/forms/applyServerErrors";
import { FISCAL_YEARS } from "@/config/site";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import type { AllotmentClassMeta } from "@/lib/constants/allotment-classes";
import { toOptions } from "@/lib/constants/options";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
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
import { RAOFE_STEP_FIELDS, raofeWizardSchema, type RaofeWizardValues } from "../../schemas";
import { DocsTable, Head, Pair } from "./RegistryAllotmentWizard";

const STEPS = [
  { title: "Allotment Details", caption: "Encode allotment information" },
  { title: "Line Items", caption: "Add allotment items" },
  { title: "Supporting Documents", caption: "Upload required documents" },
  { title: "Review and Submit", caption: "Validate and submit" },
];
const TEMPLATE_HEADERS = ["UACS Code", "Particulars / Description", "Qty", "Unit", "Unit Cost", "Category", "Remarks"];
const emptyLine = { uacsCode: "", description: "", quantity: 1, unit: "lot", unitCost: Number.NaN, remarks: "", category: "" };
export const CATEGORY_TONES = ["bg-blue-100 text-blue-800", "bg-green-100 text-green-800", "bg-purple-100 text-purple-800", "bg-amber-100 text-amber-800", "bg-pink-100 text-pink-800"];

/** Splits one CSV line, honouring double-quoted cells. */
function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/** New / edit RAOFE allotment: 4-step wizard ending in a Submit for Approval dialog. */
export function RaofeAllotmentWizard({ meta, existing }: { meta: AllotmentClassMeta; existing?: AllotmentDetail }) {
  const router = useRouter();
  const notify = useNotify();
  const user = useAppSelector(selectCurrentUser);
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
  const [dragging, setDragging] = useState(false);
  const [selectedLine, setSelectedLine] = useState(0);
  const [uacsQuery, setUacsQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declared, setDeclared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLInputElement>(null);

  const schemaRef = useRef(raofeWizardSchema(null));
  const form = useForm<RaofeWizardValues>({
    resolver: (v, c, o) => zodResolver(schemaRef.current)(v, c, o),
    mode: "onTouched",
    defaultValues: editing
      ? {
          fiscalYear: editing.fiscalYear,
          tranche: editing.tranche,
          date: editing.date.slice(0, 10),
          gaaReferenceNo: editing.gaaReferenceNo ?? "",
          department: editing.department ?? "",
          responsibilityCenter: editing.responsibilityCenter ?? "",
          uacsMajor: editing.uacsCode.slice(0, 3),
          appropriationRef: editing.appropriationRef,
          purpose: editing.purpose,
          remarks: editing.remarks ?? "",
          lineItems: editing.lineItems?.length
            ? editing.lineItems.map(({ uacsCode, description, quantity, unit, unitCost, remarks, category }) => ({ uacsCode, description, quantity, unit, unitCost, remarks, category: category ?? "" }))
            : [{ ...emptyLine }],
        }
      : {
          fiscalYear: headerFy,
          tranche: "1st Tranche",
          date: new Date().toISOString().slice(0, 10),
          gaaReferenceNo: "",
          department: "",
          responsibilityCenter: "",
          uacsMajor: "",
          appropriationRef: "",
          purpose: "",
          remarks: "",
          lineItems: [{ ...emptyLine }],
        },
  });
  const { control, register, setValue, getValues, trigger, handleSubmit, setError, formState } = form;
  const { fields, append, remove, insert, replace } = useFieldArray({ control, name: "lineItems" });
  const values = useWatch({ control }) as Partial<RaofeWizardValues>;
  const errors = formState.errors;
  const fy = values.fiscalYear ?? headerFy;

  const appropriations = useGetAppropriationsQuery({ fiscalYear: fy, allotmentClass: meta.code, pageSize: 100 });
  const nextNumber = useGetNextAllotmentNumberQuery({ fiscalYear: fy }, { skip: !!editing });
  const classApps = useMemo(() => appropriations.data?.items.filter((a) => a.status !== "Draft") ?? [], [appropriations.data]);
  const majors = [...new Set(classApps.map((a) => a.uacsCode.slice(0, 3)))].sort();
  const subs = classApps.filter((a) => !values.uacsMajor || a.uacsCode.startsWith(values.uacsMajor));
  const app = classApps.find((a) => a.referenceNo === values.appropriationRef);
  const addBack = (ref: string) => (editing && editing.appropriationRef === ref && editing.status !== "Draft" ? editing.amount : 0);
  const remaining = app ? app.amount - app.allotted + addBack(app.referenceNo) : null;
  schemaRef.current = useMemo(() => raofeWizardSchema(remaining), [remaining]);
  const classTotals = {
    appropriations: classApps.reduce((s, a) => s + a.amount, 0),
    allotments: classApps.reduce((s, a) => s + a.allotted, 0) - (editing && editing.status !== "Draft" ? editing.amount : 0),
  };

  const lineAmount = (li?: Partial<RaofeWizardValues["lineItems"][number]>) =>
    li && Number.isFinite(li.quantity) && Number.isFinite(li.unitCost) ? Number(li.quantity) * Number(li.unitCost) : 0;
  const lines = values.lineItems ?? [];
  const lineTotal = lines.reduce((s, li) => s + lineAmount(li), 0);
  const categories = lookups.data?.lineCategories ?? [];
  const tone = (c?: string) => (c && categories.includes(c) ? CATEGORY_TONES[categories.indexOf(c) % CATEGORY_TONES.length] : "bg-gray-100 text-gray-700");
  const majorLabel = (m?: string) => (!m ? "" : majors.includes(m) ? `${m} - ${meta.expenseClass.replace(/ \(.*\)$/, "")}` : m);
  const allotmentNo = editing?.allotmentNo ?? nextNumber.data?.allotmentNo ?? "";

  // UACS lookup tree: major (3 digits) › group (5 digits) › object code, for this class.
  const tree = useMemo(() => {
    const q = uacsQuery.trim().toLowerCase();
    const codes = (appLookups.data?.uacsCodes ?? []).filter((u) => u.allotmentClass === meta.code && (!q || u.code.includes(q) || u.description.toLowerCase().includes(q)));
    const byMajor = new Map<string, Map<string, typeof codes>>();
    codes.forEach((u) => {
      const groups = byMajor.get(u.code.slice(0, 3)) ?? new Map<string, typeof codes>();
      groups.set(u.code.slice(0, 5), [...(groups.get(u.code.slice(0, 5)) ?? []), u]);
      byMajor.set(u.code.slice(0, 3), groups);
    });
    return [...byMajor.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [appLookups.data, meta.code, uacsQuery]);
  const isOpen = (key: string) => !!uacsQuery.trim() || expanded.has(key) || (key.length === 3 && key === values.uacsMajor);
  const toggle = (key: string) => setExpanded((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const goTo = async (target: number) => {
    if (target > step) {
      for (let s = step; s < target; s++) {
        if (!RAOFE_STEP_FIELDS[s].length) continue;
        if (!(await trigger(RAOFE_STEP_FIELDS[s]))) {
          setStep(s);
          return;
        }
      }
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toInput = (v: Partial<RaofeWizardValues>): RegistryAllotmentInput => {
    const ref = classApps.find((a) => a.referenceNo === v.appropriationRef);
    return {
      fiscalYear: v.fiscalYear ?? headerFy,
      appropriationRef: v.appropriationRef ?? "",
      allotmentClass: meta.code,
      tranche: v.tranche ?? "1st Tranche",
      date: v.date ?? "",
      gaaReferenceNo: v.gaaReferenceNo ?? "",
      department: v.department ?? "",
      responsibilityCenter: v.responsibilityCenter ?? "",
      fundSource: ref?.fundSource ?? "",
      uacsCode: ref?.uacsCode ?? "",
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
          category: li.category ?? "",
        })),
      documentIds: documents.map((d) => d.id),
    };
  };

  const save = async (v: Partial<RaofeWizardValues>, intent: "draft" | "submit") => {
    setPending(intent);
    setSaveError(null);
    try {
      const input = toInput(v);
      const record = editing ? await update({ id: editing.id, ...input }).unwrap() : await create(input).unwrap();
      if (intent === "submit") await runWorkflow({ id: record.id, action: "submit", remarks: v.remarks?.trim() || undefined }).unwrap();
      notify("success", intent === "draft" ? "Draft saved" : "Submitted for approval", intent === "draft" ? `${record.allotmentNo} was saved as a draft.` : `${record.allotmentNo} was submitted for approval.`);
      router.push(ROUTES.allotmentClass(meta.slug));
    } catch (err) {
      applyServerErrors(err, setError);
      setSaveError(getErrorMessage(err));
      setConfirmOpen(false);
    } finally {
      setPending(null);
    }
  };

  const onDraft = () => {
    if (!getValues("appropriationRef")) {
      setConfirmOpen(false);
      setStep(0);
      setError("appropriationRef", { message: "Select the UACS sub-object code to save a draft" });
      return;
    }
    void save(getValues(), "draft");
  };
  const openSubmit = handleSubmit(
    () => setConfirmOpen(true),
    (errs) => {
      const firstBad = RAOFE_STEP_FIELDS.findIndex((fieldsOf) => fieldsOf.some((f) => f in errs));
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

  const downloadTemplate = () =>
    downloadCsv(`ebudget-${meta.slug}-line-items-template`, toCsv(TEMPLATE_HEADERS, [[app?.uacsCode ?? "", app?.objectOfExpenditure ?? "", 1, "lot", 0, categories[0] ?? "", ""]]));
  const importTemplate = async (file?: File) => {
    if (templateRef.current) templateRef.current.value = "";
    if (!file) return;
    const rows = (await file.text()).split(/\r?\n/).filter((l) => l.trim()).map(splitCsvLine);
    const header = rows.shift()?.map((h) => h.toLowerCase()) ?? [];
    if (header[0] !== TEMPLATE_HEADERS[0].toLowerCase()) {
      notify("error", "Unable to import", `Use the downloaded template. The first column must be "${TEMPLATE_HEADERS[0]}".`);
      return;
    }
    const imported = rows.map(([uacsCode = "", description = "", qty = "", unit = "", cost = "", category = "", remarks = ""]) => ({
      uacsCode,
      description,
      quantity: Number(qty) || Number.NaN,
      unit: unit || "lot",
      unitCost: Number(cost.replace(/,/g, "")) || Number.NaN,
      category: categories.includes(category) ? category : "",
      remarks,
    }));
    if (!imported.length) {
      notify("error", "Unable to import", "The template has no line items.");
      return;
    }
    const current = getValues("lineItems").filter((li) => li.uacsCode || li.description);
    replace([...current, ...imported]);
    notify("success", "Line items imported", `${imported.length} line item(s) added from ${file.name}.`);
  };

  if (lookups.isLoading || appropriations.isLoading) {
    return <><PageHeader title={`New ${meta.code} Allotment`} extraCrumbs={[`New ${meta.code} Allotment`]} /><Skeleton className="h-[640px] w-full rounded-xl" /></>;
  }

  const err = (n: keyof RaofeWizardValues) => errors[n]?.message as string | undefined;
  const inv = (n: keyof RaofeWizardValues) => ({ invalid: !!errors[n], "aria-describedby": errors[n] ? `${n}-error` : undefined });
  const sel = Math.min(selectedLine, Math.max(fields.length - 1, 0));
  const selLine = lines[sel];
  const setLine = (key: keyof RaofeWizardValues["lineItems"][number], v: string | number) =>
    setValue(`lineItems.${sel}.${key}`, v as never, { shouldValidate: formState.isSubmitted || !!errors.lineItems?.[sel]?.[key], shouldDirty: true });
  const pickUacs = (code: string, description: string) => {
    if (!fields.length) append({ ...emptyLine, uacsCode: code, description });
    else {
      setLine("uacsCode", code);
      if (!getValues(`lineItems.${sel}.description`)) setLine("description", description);
    }
  };
  const checklist = [
    { label: "Allotment details are complete", ok: RAOFE_STEP_FIELDS[0].every((f) => !errors[f]) && !!values.appropriationRef && !!values.department && !!values.gaaReferenceNo && !!values.purpose?.trim() && !!values.responsibilityCenter?.trim() },
    { label: "Line items are encoded", ok: lines.length > 0 && lines.every((li) => li.uacsCode && li.description && lineAmount(li) > 0) },
    { label: "Supporting documents are attached", ok: documents.length > 0 },
    { label: "Total is within the available balance", ok: remaining !== null && lineTotal > 0 && lineTotal <= remaining },
  ];
  const fullName = user ? `${user.firstName} ${user.lastName}` : "—";

  const allotmentInfo = (
    <dl>
      <Pair label="Allotment No.">{allotmentNo}</Pair>
      <Pair label="Fiscal Year">FY {values.fiscalYear}</Pair>
      <Pair label="Tranche">{values.tranche}</Pair>
      <Pair label="Allotment Date">{values.date ? formatDate(values.date) : ""}</Pair>
      <Pair label="GAA Reference No.">{values.gaaReferenceNo}</Pair>
      <Pair label="Department/Office">{values.department}</Pair>
      <Pair label="Responsibility Center">{values.responsibilityCenter}</Pair>
      <Pair label="Allotment Class">{meta.code}</Pair>
      <Pair label="UACS Code">{app ? `${app.uacsCode} - ${app.objectOfExpenditure}` : ""}</Pair>
      <Pair label="Total Allotment Amount"><span className="text-base font-bold text-blue-700">{formatCurrency(lineTotal)}</span></Pair>
      <Pair label="Total Line Items"><span className="font-semibold text-blue-700">{lines.length}</span></Pair>
      <Pair label="Supporting Documents"><span className="font-semibold text-green-700">{documents.length} (Uploaded)</span></Pair>
    </dl>
  );

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${editing.allotmentNo}` : `New ${meta.code} Allotment`}
        description={step === 3 ? `Review all information before submitting the ${meta.code} allotment for approval.` : `Create a new ${meta.code} allotment for financial expenses.`}
        extraCrumbs={step === 3 ? [`New ${meta.code} Allotment`, "Review and Submit"] : [editing ? editing.allotmentNo : `New ${meta.code} Allotment`]}
        actions={
          <Button variant="outline" onClick={() => router.push(ROUTES.allotmentClass(meta.slug))} className="border-blue-600 text-blue-700 hover:bg-blue-50">
            <ArrowLeft className="size-4" /> Back to List
          </Button>
        }
      />

      <Card className="mb-5 px-4 py-4 sm:px-6">
        <ol className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Allotment wizard steps">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.title} className="flex items-center gap-3" aria-current={current ? "step" : undefined}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-base font-semibold",
                    done || current ? "bg-blue-600 text-white" : "bg-gray-200 text-white",
                  )}
                >
                  {done ? <Check className="size-5" strokeWidth={3} /> : i + 1}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-semibold", done || current ? "text-blue-900" : "text-gray-800")}>{s.title}</span>
                  <span className="block text-xs text-gray-500">{s.caption}</span>
                </span>
                {i < STEPS.length - 1 && <span aria-hidden className={cn("hidden h-0.5 w-16 2xl:block", done ? "bg-blue-600" : "bg-gray-200")} />}
              </li>
            );
          })}
        </ol>
      </Card>

      {editing?.status === "Returned" && <div className="mb-5"><FormAlert>Returned for revision: {editing.workflow.find((s) => s.status === "returned")?.remarks ?? "see the history."}</FormAlert></div>}
      {saveError && <div className="mb-5"><FormAlert>{saveError}</FormAlert></div>}

      <form onSubmit={openSubmit} noValidate className="space-y-5">
        {step === 0 && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-5">
              <Card>
                <Head icon={FileText} title="General Information" />
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 md:grid-cols-2">
                  <FormField label="Allotment No." htmlFor="allotmentNo" hint={editing ? undefined : "Assigned when saved"}><Input id="allotmentNo" readOnly value={allotmentNo} className="bg-gray-50" /></FormField>
                  <FormField label="Department/Office" htmlFor="department" required error={err("department")}>
                    <Select id="department" placeholder="Select department/office" options={(lookups.data?.departments ?? []).map((d) => ({ value: d, label: d }))} {...inv("department")} {...register("department")} />
                  </FormField>
                  <FormField label="Fiscal Year" htmlFor="fiscalYear" required>
                    <Select id="fiscalYear" options={FISCAL_YEARS.map((y) => ({ value: String(y), label: `FY ${y}` }))} {...register("fiscalYear", { valueAsNumber: true, onChange: () => setValue("appropriationRef", "") })} />
                  </FormField>
                  <FormField label="Responsibility Center" htmlFor="responsibilityCenter" required error={err("responsibilityCenter")}>
                    <Input id="responsibilityCenter" placeholder="e.g. Finance Services" {...inv("responsibilityCenter")} {...register("responsibilityCenter")} />
                  </FormField>
                  <FormField label="Tranche" htmlFor="tranche" required><Select id="tranche" options={toOptions(TRANCHE_TYPES)} {...register("tranche")} /></FormField>
                  <FormField label="Allotment Class" htmlFor="allotmentClass"><Input id="allotmentClass" readOnly value={`${meta.code} - ${meta.name}`} className="bg-gray-50" /></FormField>
                  <FormField label="Allotment Date" htmlFor="date" required error={err("date")}><Input id="date" type="date" {...inv("date")} {...register("date")} /></FormField>
                  <FormField label="UACS Code (Major)" htmlFor="uacsMajor" required error={err("uacsMajor")}>
                    <Select id="uacsMajor" placeholder="Select UACS major code" options={majors.map((m) => ({ value: m, label: majorLabel(m) }))} {...inv("uacsMajor")} {...register("uacsMajor", { onChange: () => setValue("appropriationRef", "") })} />
                  </FormField>
                  <FormField label="GAA Reference No." htmlFor="gaaReferenceNo" required error={err("gaaReferenceNo")}><Input id="gaaReferenceNo" placeholder="e.g. GAA-2026-0085" {...inv("gaaReferenceNo")} {...register("gaaReferenceNo")} /></FormField>
                  <FormField label="UACS Code (Sub)" htmlFor="appropriationRef" required error={err("appropriationRef")} hint={remaining !== null ? `${app?.referenceNo} · Unallotted balance: ${formatCurrency(remaining)}` : undefined}>
                    <Select id="appropriationRef" placeholder="Select UACS sub-object code" options={subs.map((a) => ({ value: a.referenceNo, label: `${a.uacsCode} - ${a.objectOfExpenditure}` }))} {...inv("appropriationRef")} {...register("appropriationRef", { onChange: (e) => { const a = classApps.find((x) => x.referenceNo === e.target.value); if (a) { setValue("uacsMajor", a.uacsCode.slice(0, 3), { shouldValidate: !!errors.uacsMajor }); if (!getValues("purpose")) setValue("purpose", a.objectOfExpenditure); } } })} />
                  </FormField>
                  <FormField label="Particulars / Description" htmlFor="purpose" required error={err("purpose")} className="md:col-span-2">
                    <Textarea id="purpose" rows={3} maxLength={500} {...inv("purpose")} {...register("purpose")} />
                  </FormField>
                </div>
              </Card>
              <Card>
                <Head icon={NotebookPen} title="Remarks / Notes" tone="text-amber-500" />
                <div className="p-5">
                  <label htmlFor="remarks" className="mb-1.5 block text-sm font-medium text-gray-700">Remarks</label>
                  <Textarea id="remarks" rows={3} maxLength={500} placeholder="e.g. For the release of the 1st tranche for FY 2026." {...register("remarks")} />
                  <p className="text-right text-xs text-gray-500">{(values.remarks ?? "").length}/500</p>
                </div>
              </Card>
            </div>
            <div className="min-w-0 space-y-5">
              <Card className="overflow-hidden">
                <Head icon={Building2} title="Allotment Class Information" tone="text-blue-600" />
                <dl className="px-5 py-3">
                  <Pair label="Class Code">{meta.code}</Pair>
                  <Pair label="Class Name">{meta.name}</Pair>
                  <Pair label="Expense Class">{meta.expenseClass}</Pair>
                </dl>
              </Card>
              <Card className="overflow-hidden">
                <Head icon={Wallet} title="Available Budget" tone="text-green-600" />
                <dl className="space-y-2 px-5 py-4 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gray-700">Total Appropriations ({meta.code})</dt><dd className="tabular-nums">{formatCurrency(classTotals.appropriations)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-700">Total Allotments ({meta.code})</dt><dd className="tabular-nums">{formatCurrency(classTotals.allotments)}</dd></div>
                  <div className="flex justify-between gap-3 border-t border-gray-100 pt-2"><dt className="font-semibold text-green-700">Available Balance</dt><dd className="text-lg font-bold text-green-700 tabular-nums">{formatCurrency(classTotals.appropriations - classTotals.allotments)}</dd></div>
                  {app && remaining !== null && (
                    <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
                      {app.uacsCode} - {app.objectOfExpenditure}: <span className="font-semibold">{formatCurrency(remaining)}</span> unallotted
                    </div>
                  )}
                </dl>
              </Card>
            </div>
          </div>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
              <Card>
                <Head icon={FileText} title="Allotment Information" />
                <dl className="grid gap-x-8 px-5 py-3 md:grid-cols-2">
                  <div><Pair label="Allotment No.">{allotmentNo}</Pair><Pair label="FY">{values.fiscalYear}</Pair><Pair label="Tranche">{values.tranche}</Pair></div>
                  <div><Pair label="Department/Office">{values.department}</Pair><Pair label="Responsibility Center">{values.responsibilityCenter}</Pair><Pair label="Allotment Class">{meta.code}</Pair></div>
                </dl>
              </Card>
              <Card>
                <Head icon={Info} title="UACS Information" tone="text-blue-600" />
                <dl className="px-5 py-3">
                  <Pair label="UACS (Major)">{majorLabel(values.uacsMajor)}</Pair>
                  <Pair label="UACS (Sub)">{app ? `${app.uacsCode} - ${app.objectOfExpenditure}` : ""}</Pair>
                  <Pair label="Available">{remaining !== null ? formatCurrency(remaining) : ""}</Pair>
                </dl>
              </Card>
            </div>
            <Card className="overflow-hidden">
              <Head
                icon={ListChecks}
                title="Line Items"
                tone="text-green-600"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700" onClick={() => { append({ ...emptyLine }); setSelectedLine(fields.length); }}><Plus className="size-4" /> Add Line Item</Button>
                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700" onClick={() => templateRef.current?.click()}><Upload className="size-4" /> Import from Template</Button>
                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700" onClick={downloadTemplate}><Download className="size-4" /> Download Template</Button>
                    <input ref={templateRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Import line items from template" onChange={(e) => void importTemplate(e.target.files?.[0])} />
                  </div>
                }
              />
              {(errors.lineItems?.message || errors.lineItems?.root?.message) && <p className="px-5 pt-3 text-sm text-red-600" role="alert">{errors.lineItems?.message ?? errors.lineItems?.root?.message}</p>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-sm">
                  <caption className="sr-only">Line items</caption>
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-700">
                      <th scope="col" className="w-10 px-2 py-2.5 pl-5">#</th>
                      <th scope="col" className="w-36 px-2 py-2.5">UACS Code <span className="text-brand-600">*</span></th>
                      <th scope="col" className="px-2 py-2.5">Particulars / Description <span className="text-brand-600">*</span></th>
                      <th scope="col" className="w-16 px-2 py-2.5">Qty</th>
                      <th scope="col" className="w-24 px-2 py-2.5">Unit <span className="text-brand-600">*</span></th>
                      <th scope="col" className="w-32 px-2 py-2.5">Unit Cost (₱) <span className="text-brand-600">*</span></th>
                      <th scope="col" className="w-32 px-2 py-2.5 text-right">Amount (₱)</th>
                      <th scope="col" className="w-40 px-2 py-2.5">Category</th>
                      <th scope="col" className="w-36 px-2 py-2.5">Remarks</th>
                      <th scope="col" className="w-20 px-2 py-2.5 pr-5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fields.map((f, i) => {
                      const e = errors.lineItems?.[i];
                      const cell = (bad?: unknown) => cn(fieldClasses, "h-9 px-2", !!bad && "border-red-400");
                      return (
                        <tr key={f.id} className={cn("align-top", i === sel && "bg-blue-50/50")} onFocusCapture={() => setSelectedLine(i)} onClick={() => setSelectedLine(i)}>
                          <td className="px-2 py-2 pt-4 pl-5 text-gray-600">{i + 1}</td>
                          <td className="px-2 py-2">
                            <div className="relative">
                              <input aria-label={`Line ${i + 1} UACS code`} inputMode="numeric" className={cn(cell(e?.uacsCode), "pr-8")} {...register(`lineItems.${i}.uacsCode`)} />
                              <button type="button" onClick={() => { setSelectedLine(i); setUacsQuery(getValues(`lineItems.${i}.uacsCode`)); document.getElementById("uacs-lookup-search")?.focus(); }} className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-blue-700" aria-label={`Look up UACS for line ${i + 1}`}><Search className="size-3.5" /></button>
                            </div>
                            {e?.uacsCode && <p className="mt-1 text-xs text-red-600">{e.uacsCode.message}</p>}
                          </td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} description`} className={cell(e?.description)} {...register(`lineItems.${i}.description`)} />{e?.description && <p className="mt-1 text-xs text-red-600">{e.description.message}</p>}</td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} quantity`} type="number" min={0} step="any" className={cn(cell(e?.quantity), "text-right")} {...register(`lineItems.${i}.quantity`, { valueAsNumber: true })} /></td>
                          <td className="px-2 py-2"><select aria-label={`Line ${i + 1} unit`} className={cell(e?.unit)} {...register(`lineItems.${i}.unit`)}>{[...new Set(["lot", ...(oblLookups.data?.units ?? [])])].map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} unit cost`} type="number" min={0} step="0.01" className={cn(cell(e?.unitCost), "text-right")} {...register(`lineItems.${i}.unitCost`, { valueAsNumber: true })} />{e?.unitCost && <p className="mt-1 text-xs text-red-600">{e.unitCost.message}</p>}</td>
                          <td className="px-2 py-2 pt-4 text-right tabular-nums">{formatCurrency(lineAmount(lines[i])).replace("₱", "")}</td>
                          <td className="px-2 py-2">
                            <select aria-label={`Line ${i + 1} category`} className={cn(cell(), lines[i]?.category && tone(lines[i]?.category), "font-medium")} {...register(`lineItems.${i}.category`)}>
                              <option value="">Select category</option>
                              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2"><input aria-label={`Line ${i + 1} remarks`} className={cell()} {...register(`lineItems.${i}.remarks`)} /></td>
                          <td className="px-2 py-2 pr-5">
                            <span className="flex justify-center gap-1">
                              <button type="button" onClick={() => insert(i + 1, { ...getValues(`lineItems.${i}`) })} className="rounded p-1.5 text-blue-600 hover:bg-blue-50" aria-label={`Duplicate line ${i + 1}`}><Copy className="size-4" /></button>
                              <button type="button" onClick={() => { remove(i); setSelectedLine(Math.max(0, i - 1)); }} disabled={fields.length === 1} className="rounded p-1.5 text-brand-600 hover:bg-red-50 disabled:opacity-30" aria-label={`Remove line ${i + 1}`}><Trash2 className="size-4" /></button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50">
                      <td colSpan={6} className="px-3 py-3 text-right font-semibold">Total</td>
                      <td className="px-2 py-3 text-right text-lg font-bold text-blue-700 tabular-nums">{formatCurrency(lineTotal)}</td>
                      <td colSpan={3} className="px-3 py-3 pr-5 text-xs text-gray-600">{remaining !== null && <>Available: <span className={cn("font-semibold", lineTotal > remaining ? "text-red-600" : "text-green-700")}>{formatCurrency(remaining - lineTotal)}</span> after these items</>}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Card className="overflow-hidden">
                <Head
                  icon={Search}
                  title="UACS Lookup"
                  tone="text-blue-600"
                  action={<div className="w-full sm:w-64"><label htmlFor="uacs-lookup-search" className="sr-only">Search UACS code or description</label><Input id="uacs-lookup-search" value={uacsQuery} onChange={(e) => setUacsQuery(e.target.value)} placeholder="Search UACS code or description…" leftIcon={<Search className="size-4" />} /></div>}
                />
                <div className="max-h-80 overflow-y-auto">
                  <div className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] bg-gray-50 px-5 py-2 text-sm font-semibold text-gray-700"><span>Code</span><span>Description</span></div>
                  {tree.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-500">No UACS codes match “{uacsQuery}”.</p>
                  ) : (
                    <ul aria-label="UACS codes" className="text-sm">
                      {tree.map(([major, groups]) => (
                        <li key={major}>
                          <button type="button" aria-expanded={isOpen(major)} onClick={() => toggle(major)} className="grid w-full grid-cols-[minmax(0,12rem)_minmax(0,1fr)] items-center px-5 py-1.5 text-left hover:bg-gray-50">
                            <span className="flex items-center gap-1.5 font-medium">{isOpen(major) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}<Folder className="size-4 fill-amber-300 text-amber-500" aria-hidden />{major}</span>
                            <span>{majors.includes(major) ? majorLabel(major).replace(`${major} - `, "") : "Other codes in the GAA"}</span>
                          </button>
                          {isOpen(major) && (
                            <ul>
                              {[...groups.entries()].map(([group, codes]) => (
                                <li key={group}>
                                  <button type="button" aria-expanded={isOpen(group)} onClick={() => toggle(group)} className="grid w-full grid-cols-[minmax(0,12rem)_minmax(0,1fr)] items-center py-1.5 pr-5 pl-10 text-left hover:bg-gray-50">
                                    <span className="flex items-center gap-1.5">{isOpen(group) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}<Folder className="size-4 fill-amber-300 text-amber-500" aria-hidden />{group}</span>
                                    <span className="text-gray-500">{codes.length} code{codes.length === 1 ? "" : "s"}</span>
                                  </button>
                                  {isOpen(group) && (
                                    <ul>
                                      {codes.map((u) => (
                                        <li key={u.code}>
                                          <button
                                            type="button"
                                            onClick={() => pickUacs(u.code, u.description)}
                                            className={cn("grid w-full grid-cols-[minmax(0,12rem)_minmax(0,1fr)] items-center py-1.5 pr-5 pl-16 text-left hover:bg-blue-50", selLine?.uacsCode === u.code && "bg-blue-50")}
                                            aria-label={`Use ${u.code} ${u.description} for line ${sel + 1}`}
                                          >
                                            <span className="flex items-center gap-1.5 text-blue-700 tabular-nums"><Folder className="size-4 fill-amber-200 text-amber-400" aria-hidden />{u.code}</span>
                                            <span>{u.description}</span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
              <Card>
                <Head icon={ListChecks} title={`Line Item Details${fields.length ? ` – Line ${sel + 1}` : ""}`} tone="text-blue-600" />
                {selLine ? (
                  <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                    <FormField label="UACS Code" htmlFor="li-uacs" required><Input id="li-uacs" inputMode="numeric" value={selLine.uacsCode ?? ""} onChange={(e) => setLine("uacsCode", e.target.value)} /></FormField>
                    <FormField label="Particulars / Description" htmlFor="li-desc" required><Input id="li-desc" value={selLine.description ?? ""} onChange={(e) => setLine("description", e.target.value)} /></FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Quantity" htmlFor="li-qty" required><Input id="li-qty" type="number" min={0} value={Number.isFinite(selLine.quantity) ? String(selLine.quantity) : ""} onChange={(e) => setLine("quantity", e.target.value === "" ? Number.NaN : Number(e.target.value))} /></FormField>
                      <FormField label="Unit" htmlFor="li-unit" required><Select id="li-unit" value={selLine.unit ?? "lot"} onChange={(e) => setLine("unit", e.target.value)} options={[...new Set(["lot", ...(oblLookups.data?.units ?? [])])].map((u) => ({ value: u, label: u }))} /></FormField>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Unit Cost (₱)" htmlFor="li-cost" required><Input id="li-cost" type="number" min={0} step="0.01" value={Number.isFinite(selLine.unitCost) ? String(selLine.unitCost) : ""} onChange={(e) => setLine("unitCost", e.target.value === "" ? Number.NaN : Number(e.target.value))} /></FormField>
                      <FormField label="Amount (₱)" htmlFor="li-amount"><Input id="li-amount" readOnly value={formatCurrency(lineAmount(selLine)).replace("₱", "")} className="bg-gray-50" /></FormField>
                    </div>
                    <FormField label="Category" htmlFor="li-category"><Select id="li-category" placeholder="Select category" value={selLine.category ?? ""} onChange={(e) => setLine("category", e.target.value)} options={categories.map((c) => ({ value: c, label: c }))} /></FormField>
                    <FormField label="Remarks" htmlFor="li-remarks"><Textarea id="li-remarks" rows={2} maxLength={500} value={selLine.remarks ?? ""} onChange={(e) => setLine("remarks", e.target.value)} /></FormField>
                  </div>
                ) : (
                  <p className="p-5 text-sm text-gray-500">Select a line item to edit its details.</p>
                )}
              </Card>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Card>
              <Head icon={Paperclip} title="Upload Supporting Documents" tone="text-purple-600" />
              <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                <div className="space-y-3">
                  <FormField label="Document Category" htmlFor="doc-category">
                    <Select id="doc-category" value={docCategory} onChange={(e) => setDocCategory(e.target.value)} placeholder="Select category" options={(lookups.data?.documentCategories ?? []).map((c) => ({ value: c, label: c }))} />
                  </FormField>
                  <FormField label="Description" htmlFor="doc-description"><Input id="doc-description" value={docDescription} onChange={(e) => setDocDescription(e.target.value)} placeholder="e.g. Memorandum of Agreement" /></FormField>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={cn("flex min-h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center", dragging ? "border-blue-500 bg-blue-50" : "border-blue-300 bg-blue-50/30")}
                >
                  <CloudUpload className="size-10 text-blue-600" aria-hidden />
                  <p className="mt-2 text-gray-800">Drag and drop files here or <button type="button" onClick={() => fileRef.current?.click()} className="font-semibold text-blue-600 hover:underline">click to browse</button></p>
                  <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX, XLSX, JPG, PNG (Max 10 MB per file)</p>
                  {uploading && <p className="mt-2 text-xs text-blue-700">Uploading…</p>}
                  <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png" className="sr-only" aria-label="Upload supporting documents" onChange={(e) => void addFiles(e.target.files)} />
                </div>
              </div>
            </Card>
            <Card className="overflow-hidden">
              <Head
                icon={FileText}
                title={`Supporting Documents (${documents.length})`}
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
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <Card>
              <Head icon={FileText} title="Allotment Information" action={<Button variant="outline" size="sm" onClick={() => setStep(0)}>Edit</Button>} />
              <div className="px-5 py-3">{allotmentInfo}</div>
            </Card>
            <div className="min-w-0 space-y-5">
              <Card className="overflow-hidden">
                <Head icon={ListChecks} title="Line Items" tone="text-green-600" action={<Button variant="outline" size="sm" onClick={() => setStep(1)}>Edit</Button>} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <caption className="sr-only">Line items summary</caption>
                    <thead>
                      <tr className="bg-gray-50 text-gray-700">
                        {["#", "UACS Code", "Particulars / Description", "Qty", "Unit", "Unit Cost (₱)", "Amount (₱)", "Category"].map((h, i) => <th key={h} scope="col" className={cn("px-3 py-2 first:pl-5 last:pr-5", [3, 5, 6].includes(i) ? "text-right" : "text-left")}>{h}</th>)}
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
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(lineAmount(li)).replace("₱", "")}</td>
                          <td className="px-3 py-2 pr-5">{li.category ? <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone(li.category))}>{li.category}</span> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="bg-blue-50"><td colSpan={6} className="px-3 py-2.5 text-right font-semibold">Total</td><td className="px-3 py-2.5 text-right font-bold text-blue-700 tabular-nums">{formatCurrency(lineTotal)}</td><td /></tr></tfoot>
                  </table>
                </div>
              </Card>
              <Card className="overflow-hidden">
                <Head icon={Paperclip} title="Supporting Documents" tone="text-purple-600" action={<Button variant="outline" size="sm" onClick={() => setStep(2)}>Edit</Button>} />
                <DocsTable documents={documents} />
              </Card>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Card>
                  <Head icon={CheckCircle2} title="Checklist" tone="text-green-600" />
                  <ul className="space-y-2.5 p-5 text-sm">
                    {checklist.map((c) => (
                      <li key={c.label} className="flex items-center gap-2.5">
                        {c.ok ? <CheckCircle2 className="size-5 fill-blue-600 text-white" aria-hidden /> : <XCircle className="size-5 fill-red-600 text-white" aria-hidden />}
                        <span>{c.label}</span>
                        <span className="sr-only">{c.ok ? "(complete)" : "(incomplete)"}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card>
                  <Head icon={NotebookPen} title="Remarks" tone="text-amber-500" />
                  <div className="p-5">
                    <label htmlFor="remarks-review" className="sr-only">Remarks</label>
                    <Textarea id="remarks-review" rows={3} maxLength={500} {...register("remarks")} />
                    <p className="text-right text-xs text-gray-500">{(values.remarks ?? "").length}/500</p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-3 border-t border-gray-200 pt-4">
          {step > 0 ? (
            <Button variant="outline" size="lg" onClick={() => goTo(step - 1)} className="border-blue-600 text-blue-700"><ArrowLeft className="size-4" /> Previous</Button>
          ) : <span />}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="lg" className="border-blue-600 text-blue-700" onClick={() => router.push(editing ? ROUTES.classAllotment(meta.slug, editing.id) : ROUTES.allotmentClass(meta.slug))}><X className="size-4" /> Cancel</Button>
            <Button variant="outline" size="lg" className="border-blue-600 text-blue-700" onClick={onDraft} loading={pending === "draft"} disabled={!!pending}>{pending !== "draft" && <Save className="size-4" />} Save as Draft</Button>
            {step < 3 ? (
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => goTo(step + 1)}>Next <ArrowRight className="size-4" /> {STEPS[step + 1].title}</Button>
            ) : (
              <Button type="submit" size="lg" className="bg-green-600 hover:bg-green-700" disabled={!!pending}><Send className="size-4" /> Submit for Approval</Button>
            )}
          </div>
        </div>
      </form>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="xl"
        title={<span className="flex items-center gap-2"><Send className="size-5 text-blue-700" aria-hidden /> Submit for Approval</span>}
        description={`Submit this ${meta.code} allotment to the approver for review and approval.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}><X className="size-4" /> Cancel</Button>
            <Button variant="outline" onClick={onDraft} loading={pending === "draft"} disabled={!!pending}>{pending !== "draft" && <Save className="size-4" />} Save as Draft</Button>
            <Button className="bg-green-600 hover:bg-green-700" disabled={!declared || !!pending} loading={pending === "submit"} onClick={() => save(getValues(), "submit")}>{pending !== "submit" && <Send className="size-4" />} Submit for Approval</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200">
            <h3 className="flex items-center gap-2 border-b border-gray-100 bg-blue-50/60 px-4 py-3 font-semibold text-gray-900"><FileText className="size-5 text-brand-600" aria-hidden /> Allotment Information</h3>
            <div className="px-4 py-2">{allotmentInfo}</div>
          </section>
          <div className="space-y-5">
            <section className="rounded-xl border border-gray-200">
              <h3 className="flex items-center gap-2 border-b border-gray-100 bg-blue-50/60 px-4 py-3 font-semibold text-gray-900"><Landmark className="size-5 text-blue-600" aria-hidden /> Approval Workflow</h3>
              <ol className="space-y-3 px-4 py-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">1</span>
                  <span className="flex-1"><span className="block text-blue-700">Prepared by</span><span className="block font-semibold">{fullName}</span><span className="block text-xs text-gray-500">{user?.position}</span></span>
                  <span className="text-right text-xs"><span className="flex items-center justify-end gap-1 font-medium text-green-700"><CheckCircle2 className="size-4" /> Completed</span>{formatDateTime(new Date().toISOString())}</span>
                </li>
                {(lookups.data?.approvers ?? []).map((ap, i) => (
                  <li key={ap.step} className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">{i + 2}</span>
                    <span className="flex-1 font-medium text-gray-900">{ap.label}</span>
                    <span className="rounded-md bg-blue-50 px-3 py-0.5 text-xs text-blue-800">Pending</span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="rounded-xl border border-gray-200">
              <h3 className="flex items-center gap-2 border-b border-gray-100 bg-blue-50/60 px-4 py-3 font-semibold text-gray-900"><NotebookPen className="size-5 text-purple-600" aria-hidden /> Remarks <span className="font-normal text-gray-500">(Optional)</span></h3>
              <div className="p-4">
                <label htmlFor="remarks-submit" className="sr-only">Remarks</label>
                <Textarea id="remarks-submit" rows={3} maxLength={500} value={values.remarks ?? ""} onChange={(e) => setValue("remarks", e.target.value, { shouldDirty: true })} />
                <p className="text-right text-xs text-gray-500">{(values.remarks ?? "").length}/500</p>
              </div>
            </section>
          </div>
        </div>
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-gray-800">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-blue-600" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
          <span>
            <span className="mb-1 flex items-center gap-1.5 font-semibold"><ShieldCheck className="size-4 text-amber-600" aria-hidden /> Declaration</span>
            I hereby certify that the information provided in this {meta.code} allotment is complete, true and correct.
          </span>
        </label>
      </Modal>
    </>
  );
}
