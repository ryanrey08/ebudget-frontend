"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { AmountInput } from "@/components/forms/AmountInput";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { ErrorState } from "@/components/shared/ErrorState";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { LookupSelect, type LookupKind } from "@/features/master-data/components/LookupSelect";
import { useBackendFiscalYear } from "@/hooks/useBackendFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { ROUTES } from "@/lib/constants/routes";
import { formatCurrency } from "@/lib/utils/format";
import { pesos, toPesoString } from "@/types/backend";
import { useCreateAppropriationLineMutation, useGetAppropriationLineQuery, useUpdateAppropriationLineMutation } from "../../services/appropriationLinesApi";
import { APPROPRIATION_LEVELS, APPROPRIATION_TYPES, type AppropriationLine, type AppropriationLineInput } from "../../types/lines";

interface Values {
  fiscal_year_id: string;
  organization_id: string;
  title: string;
  level: string;
  type: string;
  legal_reference: string;
  effectivity_date: string;
  expiry_date: string;
  prexc_item_id: string;
  uacs_object_id: string;
  fund_source_id: string;
  allotment_class_id: string;
  amount: number;
  remarks: string;
}

const REFS: { name: keyof Values; label: string; kind: LookupKind; relation: keyof AppropriationLine }[] = [
  { name: "organization_id", label: "Organization", kind: "organization", relation: "organization" },
  { name: "prexc_item_id", label: "PAP (PREXC item)", kind: "prexc", relation: "prexc_item" },
  { name: "uacs_object_id", label: "UACS object of expenditure", kind: "uacs", relation: "uacs_object" },
  { name: "fund_source_id", label: "Fund source", kind: "fund", relation: "fund_source" },
  { name: "allotment_class_id", label: "Allotment class", kind: "class", relation: "allotment_class" },
];

/** Changing these on a line with an allotment answers 409 appropriation_allotted. */
const LOCKED_WHEN_ALLOTTED: (keyof Values)[] = ["fiscal_year_id", "organization_id", "prexc_item_id", "uacs_object_id", "fund_source_id", "allotment_class_id"];

function fromLine(l: AppropriationLine): Values {
  return {
    fiscal_year_id: l.fiscal_year_id,
    organization_id: String(l.organization_id),
    title: l.title ?? "",
    level: l.level,
    type: l.type,
    legal_reference: l.legal_reference ?? "",
    effectivity_date: l.effectivity_date,
    expiry_date: l.expiry_date ?? "",
    prexc_item_id: String(l.prexc_item_id),
    uacs_object_id: String(l.uacs_object_id),
    fund_source_id: String(l.fund_source_id),
    allotment_class_id: String(l.allotment_class_id),
    amount: pesos(l.amount),
    remarks: l.remarks ?? "",
  };
}

export function AppropriationLineFormView({ lineId }: { lineId?: number }) {
  return (
    <>
      <PageHeader
        title={lineId ? "Edit Appropriation" : "New Appropriation"}
        description="One appropriation line: an amount for one organization, PAP, UACS object and fund source."
        extraCrumbs={[lineId ? "Edit" : "New"]}
      />
      <BackendRequired>{lineId ? <EditLine id={lineId} /> : <LineForm />}</BackendRequired>
    </>
  );
}

function EditLine({ id }: { id: number }) {
  const line = useGetAppropriationLineQuery(id);
  if (line.error) return <ErrorState error={line.error} onRetry={line.refetch} />;
  if (!line.data) return <Skeleton className="h-96 w-full" />;
  return <LineForm line={line.data} />;
}

function LineForm({ line }: { line?: AppropriationLine }) {
  const router = useRouter();
  const notify = useNotify();
  const fy = useBackendFiscalYear();
  const [create, createState] = useCreateAppropriationLineMutation();
  const [update, updateState] = useUpdateAppropriationLineMutation();
  const busy = createState.isLoading || updateState.isLoading;
  const initial = useMemo<Values>(
    () =>
      line
        ? fromLine(line)
        : {
            fiscal_year_id: "",
            organization_id: "",
            title: "",
            level: "agency",
            type: "gaa",
            legal_reference: "",
            effectivity_date: "",
            expiry_date: "",
            prexc_item_id: "",
            uacs_object_id: "",
            fund_source_id: "",
            allotment_class_id: "",
            amount: Number.NaN,
            remarks: "",
          },
    [line],
  );
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const allotted = !!line && pesos(line.allotted_amount) > 0;
  const openYears = fy.all.filter((y) => y.status === "open" || y.id === line?.fiscal_year_id);

  // New line: start in the header's fiscal year with its period.
  useEffect(() => {
    if (line || values.fiscal_year_id || !fy.record) return;
    setValues((v) => ({ ...v, fiscal_year_id: fy.record!.id, effectivity_date: fy.record!.start_date, expiry_date: fy.record!.end_date }));
  }, [fy.record, line, values.fiscal_year_id]);

  const set = <K extends keyof Values>(name: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors(({ [name]: _drop, ...rest }) => rest);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const required: (keyof Values)[] = ["fiscal_year_id", "organization_id", "level", "type", "effectivity_date", "prexc_item_id", "uacs_object_id", "fund_source_id", "allotment_class_id"];
    for (const k of required) if (!String(values[k] ?? "").trim()) e[k] = "Required.";
    if (!Number.isFinite(values.amount)) e.amount = "Enter the amount.";
    else if (values.amount <= 0) e.amount = "The amount must be more than zero.";
    else if (!/^\d{1,15}(\.\d{1,2})?$/.test(String(values.amount))) e.amount = "Up to 15 digits and 2 decimals.";
    if (values.expiry_date && values.effectivity_date && values.expiry_date < values.effectivity_date) e.expiry_date = "The expiry date must be on or after the effectivity date.";
    if (values.title.length > 255) e.title = "At most 255 characters.";
    if (values.legal_reference.length > 255) e.legal_reference = "At most 255 characters.";
    if (values.remarks.length > 1000) e.remarks = "At most 1000 characters.";
    return e;
  };

  const toInput = (): AppropriationLineInput => {
    const all: AppropriationLineInput = {
      fiscal_year_id: values.fiscal_year_id,
      organization_id: Number(values.organization_id),
      title: values.title.trim() || null,
      level: values.level as AppropriationLineInput["level"],
      type: values.type as AppropriationLineInput["type"],
      legal_reference: values.legal_reference.trim() || null,
      effectivity_date: values.effectivity_date,
      expiry_date: values.expiry_date || null,
      prexc_item_id: Number(values.prexc_item_id),
      uacs_object_id: Number(values.uacs_object_id),
      fund_source_id: Number(values.fund_source_id),
      allotment_class_id: Number(values.allotment_class_id),
      amount: toPesoString(values.amount),
      remarks: values.remarks.trim() || null,
    };
    if (!line) return all;
    // PATCH: send only what changed.
    const before = fromLine(line);
    const changed: AppropriationLineInput = {};
    for (const key of Object.keys(all) as (keyof AppropriationLineInput)[]) {
      const a = key === "amount" ? values.amount : values[key as keyof Values];
      const b = key === "amount" ? before.amount : before[key as keyof Values];
      if (String(a).trim() !== String(b).trim()) (changed as Record<string, unknown>)[key] = all[key];
    }
    return changed;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local = validate();
    if (Object.keys(local).length) return setErrors(local);
    setGeneral("");
    try {
      if (line) {
        const input = toInput();
        if (!Object.keys(input).length) return router.push(ROUTES.appropriations);
        const saved = await update({ id: line.id, input }).unwrap();
        notify("success", "Appropriation updated", saved.appropriation_no);
      } else {
        const saved = await create(toInput()).unwrap();
        notify("success", "Appropriation created", saved.appropriation_no);
      }
      router.push(ROUTES.appropriations);
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      if (!(isApiError(err) && err.fieldErrors)) setGeneral(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {general && <FormAlert>{general}</FormAlert>}
      {fy.missing && !line && <FormAlert tone="info">FY {fy.year} doesn&apos;t exist in the backend yet. Add it under Master Data → Fiscal Years.</FormAlert>}
      {allotted && (
        <FormAlert tone="info">
          This line has allotment {line?.allotment?.allotment_no} ({formatCurrency(pesos(line?.allotted_amount))}). Its fiscal year, organization and codes can&apos;t change, and the amount
          can&apos;t go below what is allotted. Title, legal reference, period and remarks can still change.
        </FormAlert>
      )}

      <Card>
        <CardHeader title="Appropriation" description={line ? line.appropriation_no : "The number (APP-YYYY-NNN) is assigned when saved."} />
        <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField label="Fiscal year" htmlFor="fiscal_year_id" error={errors.fiscal_year_id} required hint="Only open years can take lines.">
            <Select
              id="fiscal_year_id"
              value={values.fiscal_year_id}
              disabled={allotted}
              onChange={(e) => set("fiscal_year_id", e.target.value)}
              placeholder="Select…"
              invalid={!!errors.fiscal_year_id}
              options={openYears.map((y) => ({ value: y.id, label: `${y.name}${y.status !== "open" ? ` (${y.status})` : ""}` }))}
            />
          </FormField>
          <FormField label="Level" htmlFor="level" error={errors.level} required>
            <Select id="level" value={values.level} onChange={(e) => set("level", e.target.value)} options={APPROPRIATION_LEVELS} />
          </FormField>
          <FormField label="Type" htmlFor="type" error={errors.type} required>
            <Select id="type" value={values.type} onChange={(e) => set("type", e.target.value)} options={APPROPRIATION_TYPES} />
          </FormField>
          <FormField label="Title" htmlFor="title" error={errors.title} className="md:col-span-2">
            <Input id="title" maxLength={255} value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. General Appropriations Act FY 2026" />
          </FormField>
          <FormField label="Legal reference" htmlFor="legal_reference" error={errors.legal_reference}>
            <Input id="legal_reference" maxLength={255} value={values.legal_reference} onChange={(e) => set("legal_reference", e.target.value)} placeholder="e.g. R.A. No. 12116" />
          </FormField>
          <FormField label="Effectivity date" htmlFor="effectivity_date" error={errors.effectivity_date} required>
            <Input id="effectivity_date" type="date" value={values.effectivity_date} onChange={(e) => set("effectivity_date", e.target.value)} invalid={!!errors.effectivity_date} />
          </FormField>
          <FormField label="Expiry date" htmlFor="expiry_date" error={errors.expiry_date} hint="Leave empty for no set end.">
            <Input id="expiry_date" type="date" value={values.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} invalid={!!errors.expiry_date} />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Line" description="Only active records can be chosen. A PAP that is a heading can't take amounts." />
        <CardBody className="grid gap-4 md:grid-cols-2">
          {REFS.map((r) => {
            const rel = line?.[r.relation] as { id: number; code: string; name?: string; description?: string } | undefined;
            return (
              <FormField key={r.name} label={r.label} htmlFor={r.name} error={errors[r.name]} required>
                <LookupSelect
                  id={r.name}
                  kind={r.kind}
                  value={String(values[r.name])}
                  onChange={(v) => set(r.name, v as never)}
                  invalid={!!errors[r.name]}
                  disabled={allotted && LOCKED_WHEN_ALLOTTED.includes(r.name)}
                  current={rel ? { value: String(rel.id), label: `${rel.code} – ${rel.name ?? rel.description ?? ""}` } : null}
                />
              </FormField>
            );
          })}
          <FormField label="Appropriation amount" htmlFor="amount" error={errors.amount} required hint={allotted ? `At least ${formatCurrency(pesos(line?.allotted_amount))} (allotted).` : "Pesos, up to 2 decimals."}>
            <AmountInput id="amount" value={values.amount} onChange={(n) => set("amount", n)} invalid={!!errors.amount} />
          </FormField>
          <FormField label="Remarks" htmlFor="remarks" error={errors.remarks} className="md:col-span-2">
            <Textarea id="remarks" rows={2} maxLength={1000} value={values.remarks} onChange={(e) => set("remarks", e.target.value)} />
          </FormField>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={ROUTES.appropriations} className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </Link>
        <Button type="submit" loading={busy}>
          {line ? "Save changes" : "Save appropriation"}
        </Button>
      </div>
    </form>
  );
}
