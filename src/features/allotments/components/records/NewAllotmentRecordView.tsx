"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { AmountInput } from "@/components/forms/AmountInput";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { BackendRequired, MissingFiscalYear } from "@/components/backend/DataSourceNotice";
import { useGetAppropriationLineQuery, useGetAppropriationLinesQuery } from "@/features/appropriations/services/appropriationLinesApi";
import type { AppropriationLine } from "@/features/appropriations/types/lines";
import { useBackendFiscalYear } from "@/hooks/useBackendFiscalYear";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { pesos, toPesoString } from "@/types/backend";
import { useAddAllotmentReleaseMutation, useCreateAllotmentRecordMutation, useSubmitAllotmentReleaseMutation } from "../../services/allotmentRecordsApi";
import type { ReleaseInput } from "../../types/records";
import { ReleaseFields, emptyRelease, validateRelease, type ReleaseValues } from "./ReleaseFields";
import { WorkflowPreview } from "./WorkflowPreview";

export function NewAllotmentRecordView() {
  return (
    <>
      <PageHeader title="New Allotment" description="Set an amount aside from an appropriation line and release it in tranches." extraCrumbs={["New"]} />
      <BackendRequired>
        <NewAllotment />
      </BackendRequired>
    </>
  );
}

function NewAllotment() {
  const params = useSearchParams();
  const fy = useBackendFiscalYear();
  const preset = Number(params.get("appropriation")) || 0;
  const presetLine = useGetAppropriationLineQuery(preset, { skip: !preset });
  const [line, setLine] = useState<AppropriationLine | null>(null);
  useEffect(() => {
    if (presetLine.data && !line) setLine(presetLine.data);
  }, [presetLine.data, line]);

  if (fy.missing && !preset) return <MissingFiscalYear year={fy.year} />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        <LinePicker fiscalYearId={line?.fiscal_year_id ?? fy.id} selected={line} onSelect={setLine} />
        {preset && presetLine.isLoading && <Skeleton className="h-64 w-full" />}
        {line && <AllotmentForm key={line.id} line={line} />}
      </div>
      <div className="space-y-5">
        {line && <LineSummary line={line} />}
        <WorkflowPreview />
      </div>
    </div>
  );
}

function LinePicker({ fiscalYearId, selected, onSelect }: { fiscalYearId?: string; selected: AppropriationLine | null; onSelect: (l: AppropriationLine) => void }) {
  const [draft, setDraft] = useState("");
  const search = useDebouncedValue(draft.trim(), 350);
  const lines = useGetAppropriationLinesQuery({ fiscal_year_id: fiscalYearId, has_balance: 1, search: search || undefined, per_page: 10 }, { skip: !fiscalYearId });
  return (
    <Card>
      <CardHeader title="1. Appropriation line" description="Lines of the fiscal year that can still take a release." />
      <CardBody className="space-y-3">
        <Input type="search" aria-label="Search appropriation lines" maxLength={100} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search by APP no., title, organization, PAP or UACS code…" leftIcon={<Search className="size-4" />} />
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
          {lines.isFetching && !lines.currentData && <li className="p-3"><Skeleton className="h-10 w-full" /></li>}
          {lines.data?.items.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => onSelect(l)} className={cn("flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50", selected?.id === l.id && "bg-brand-50")}>
                <span className="min-w-0">
                  <span className="font-medium text-gray-900">{l.appropriation_no}</span> <span className="text-gray-500">· {l.allotment_class?.code}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {l.uacs_object?.code} – {l.uacs_object?.description} · {l.organization?.code}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className="block font-medium text-gray-900 tabular-nums">{formatCurrency(pesos(l.unallotted_amount))}</span>
                  <span className="text-gray-500">{l.allotment ? `${l.allotment.allotment_no}: next ${l.allotment.next_tranche_label ?? "tranche"}` : "unallotted"}</span>
                </span>
              </button>
            </li>
          ))}
          {lines.data && !lines.data.items.length && <li className="px-3 py-6 text-center text-sm text-gray-500">No lines with a balance{search ? " match the search" : ""}.</li>}
        </ul>
        {lines.error ? <FormAlert>{getErrorMessage(lines.error)}</FormAlert> : null}
      </CardBody>
    </Card>
  );
}

function LineSummary({ line }: { line: AppropriationLine }) {
  const rows: [string, string][] = [
    ["Appropriation", line.appropriation_no],
    ["Organization", line.organization ? `${line.organization.code} – ${line.organization.name}` : "—"],
    ["PAP", line.prexc_item ? `${line.prexc_item.code} – ${line.prexc_item.description}` : "—"],
    ["UACS object", line.uacs_object ? `${line.uacs_object.code} – ${line.uacs_object.description}` : "—"],
    ["Fund source", line.fund_source?.code ?? "—"],
    ["Allotment class", line.allotment_class?.code ?? "—"],
    ["Period", `${formatDate(line.effectivity_date)} – ${line.expiry_date ? formatDate(line.expiry_date) : "no set end"}`],
    ["Line amount", formatCurrency(pesos(line.amount))],
    ["Allotted", formatCurrency(pesos(line.allotted_amount))],
    ["Unallotted", formatCurrency(pesos(line.unallotted_amount))],
  ];
  return (
    <Card>
      <CardHeader title="Line" />
      <CardBody>
        <dl className="space-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-gray-500">{k}</dt>
              <dd className="text-right text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

function AllotmentForm({ line }: { line: AppropriationLine }) {
  const router = useRouter();
  const notify = useNotify();
  const existing = line.allotment ?? null;
  const [create, createState] = useCreateAllotmentRecordMutation();
  const [addRelease, addState] = useAddAllotmentReleaseMutation();
  const [submitRelease, submitState] = useSubmitAllotmentReleaseMutation();
  const busy = createState.isLoading || addState.isLoading || submitState.isLoading;
  const [amount, setAmount] = useState<number>(Number.NaN);
  const [purpose, setPurpose] = useState("");
  const [release, setRelease] = useState<ReleaseValues>(emptyRelease(line.effectivity_date));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");

  const unallotted = pesos(line.unallotted_amount);
  const left = existing ? pesos(existing.unreleased_amount) : Number.isFinite(amount) ? amount : 0;
  const period = useMemo(() => ({ from: line.effectivity_date, to: line.expiry_date }), [line]);

  const releaseInput = (): ReleaseInput => ({
    release_kind: release.release_kind,
    amount: release.release_kind === "tranche" ? toPesoString(release.amount) : undefined,
    release_date: release.release_date,
    reference_no: release.reference_no.trim() || null,
  });

  const save = async (submit: boolean) => {
    const e: Record<string, string> = {};
    if (!existing) {
      if (!Number.isFinite(amount) || amount <= 0) e.amount = "Enter the allotment amount.";
      else if (amount > unallotted + 1e-9) e.amount = `The allotment amount can't be more than the unallotted balance of the appropriation line (${formatCurrency(unallotted)}).`;
      if (!purpose.trim()) e.purpose = "Enter the purpose.";
      else if (purpose.length > 500) e.purpose = "At most 500 characters.";
    }
    Object.assign(e, validateRelease(release, { left, period }, existing ? "" : "release."));
    if (Object.keys(e).length) return setErrors(e);
    setErrors({});
    setGeneral("");

    let allotmentId = existing?.id;
    try {
      const record = existing
        ? await addRelease({ id: existing.id, input: releaseInput() }).unwrap()
        : await create({ appropriation_id: line.id, amount: toPesoString(amount), purpose: purpose.trim(), release: releaseInput() as Required<Pick<ReleaseInput, "release_kind" | "release_date">> & ReleaseInput }).unwrap();
      allotmentId = record.id;
      const draft = [...(record.releases ?? [])].reverse().find((r) => r.status === "draft");
      if (submit && draft) {
        try {
          await submitRelease({ id: record.id, releaseId: draft.id }).unwrap();
          notify("success", "Submitted for approval", `${record.allotment_no} · ${draft.tranche_label}`);
        } catch (err) {
          notify("warning", "Saved as draft, but not submitted", getErrorMessage(err));
        }
      } else notify("success", existing ? "Tranche saved as draft" : "Allotment saved as draft", record.allotment_no);
      router.push(ROUTES.allotment(record.id));
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      setGeneral(getErrorMessage(err));
      if (allotmentId && !existing) router.push(ROUTES.allotment(allotmentId));
    }
  };

  return (
    <Card>
      <CardHeader
        title={existing ? `2. Next tranche of ${existing.allotment_no}` : "2. Allotment"}
        description={existing ? "This line already has an allotment: add its next tranche." : "The allotment number is assigned when saved."}
      />
      <CardBody className="space-y-5">
        {general && <FormAlert>{general}</FormAlert>}
        {existing ? (
          <dl className="grid gap-3 rounded-lg border border-gray-200 p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Allotment amount" value={formatCurrency(pesos(existing.amount))} />
            <Fact label="Released" value={formatCurrency(pesos(existing.released_amount))} />
            <Fact label="Pending approval" value={formatCurrency(pesos(existing.pending_amount))} />
            <Fact label="Remaining to release" value={formatCurrency(pesos(existing.unreleased_amount))} />
            <div className="sm:col-span-2 xl:col-span-4">
              <dt className="text-xs text-gray-500">Purpose</dt>
              <dd className="text-gray-900">{existing.purpose}</dd>
            </div>
          </dl>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Allotment amount" htmlFor="amount" error={errors.amount} required hint={`At most ${formatCurrency(unallotted)} (unallotted).`}>
              <AmountInput id="amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
            </FormField>
            <FormField label="Purpose / Particulars" htmlFor="purpose" error={errors.purpose} required className="md:col-span-2">
              <Textarea id="purpose" rows={2} maxLength={500} value={purpose} onChange={(e) => setPurpose(e.target.value)} invalid={!!errors.purpose} />
            </FormField>
          </div>
        )}
        <div>
          <p className="mb-3 text-sm font-semibold text-gray-900">{existing ? existing.next_tranche_label ?? "Next tranche" : "1st tranche"}</p>
          <ReleaseFields values={release} onChange={(p) => setRelease((r) => ({ ...r, ...p }))} errors={errors} prefix={existing ? "" : "release."} left={left} trancheLabel={existing?.next_tranche_label} />
        </div>
        {existing && pesos(existing.pending_amount) > 0 && <FormAlert tone="info">Another tranche is still open (draft, pending or rejected). Finish it on the allotment page first.</FormAlert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={ROUTES.allotments} className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <Button variant="outline" onClick={() => save(false)} loading={busy}>
            Save as draft
          </Button>
          <Button onClick={() => save(true)} loading={busy}>
            Submit for approval
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 tabular-nums">{value}</dd>
    </div>
  );
}
