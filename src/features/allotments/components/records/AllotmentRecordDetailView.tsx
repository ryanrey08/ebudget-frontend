"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Download, FileText, MoreHorizontal, Pencil, Plus, Send, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DropdownMenu, type MenuItem } from "@/components/ui/DropdownMenu";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AmountInput } from "@/components/forms/AmountInput";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { PromptDialog } from "@/components/backend/PromptDialog";
import { ApprovalRequestPanel } from "@/features/approvals/components/ApprovalRequestView";
import { useCan } from "@/hooks/useCan";
import { useNotify } from "@/hooks/useNotify";
import { saveDownloadedFile } from "@/lib/api/api-client";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { ROUTES } from "@/lib/constants/routes";
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/utils/format";
import { allotmentRecordsService } from "@/services/backend";
import { pesos, toPesoString } from "@/types/backend";
import {
  useAddAllotmentReleaseMutation,
  useCancelAllotmentRecordMutation,
  useCancelAllotmentReleaseMutation,
  useDeleteAllotmentAttachmentMutation,
  useDeleteAllotmentRecordMutation,
  useDeleteAllotmentReleaseMutation,
  useGetAllotmentRecordQuery,
  useSubmitAllotmentReleaseMutation,
  useUpdateAllotmentRecordMutation,
  useUpdateAllotmentReleaseMutation,
  useUploadAllotmentAttachmentMutation,
} from "../../services/allotmentRecordsApi";
import type { AllotmentAttachment, AllotmentRecord, AllotmentRelease, ReleaseInput } from "../../types/records";
import { ReleaseFields, emptyRelease, validateRelease, type ReleaseValues } from "./ReleaseFields";

const DOC_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "image/png"];

export function AllotmentRecordDetailView({ id }: { id: string }) {
  return (
    <BackendRequired>
      <Detail id={id} />
    </BackendRequired>
  );
}

type Dialog =
  | { kind: "edit" }
  | { kind: "cancel" }
  | { kind: "delete" }
  | { kind: "release"; release?: AllotmentRelease }
  | { kind: "submit"; release: AllotmentRelease }
  | { kind: "deleteRelease"; release: AllotmentRelease }
  | { kind: "cancelRelease"; release: AllotmentRelease }
  | { kind: "deleteDoc"; doc: AllotmentAttachment };

function Detail({ id }: { id: string }) {
  const router = useRouter();
  const notify = useNotify();
  const canManage = useCan("allotments.manage");
  const query = useGetAllotmentRecordQuery(id);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [cancelAllotment] = useCancelAllotmentRecordMutation();
  const [deleteAllotment] = useDeleteAllotmentRecordMutation();
  const [submitRelease] = useSubmitAllotmentReleaseMutation();
  const [deleteRelease] = useDeleteAllotmentReleaseMutation();
  const [cancelRelease] = useCancelAllotmentReleaseMutation();
  const [deleteDoc] = useDeleteAllotmentAttachmentMutation();

  if (query.error) {
    return (
      <>
        <PageHeader title="Allotment" />
        <ErrorState error={query.error} onRetry={query.refetch} />
      </>
    );
  }
  const a = query.data;
  if (!a) {
    return (
      <>
        <PageHeader title="Allotment" />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  const releases = a.releases ?? [];
  const cancelled = a.status === "cancelled";
  const fyOpen = a.fiscal_year?.status === "open";
  const editable = canManage && fyOpen && !cancelled;
  const openRelease = releases.find((r) => r.status === "draft" || r.status === "pending" || r.status === "rejected");
  const pendingApproval = releases.find((r) => r.status === "pending" && r.approval)?.approval;
  const neverSubmitted = a.status === "draft" && releases.every((r) => r.status === "draft" && !r.approval);
  const line = a.appropriation;

  const releaseColumns: Column<AllotmentRelease>[] = [
    { key: "tranche", header: "Tranche", cell: (r) => <span className="font-medium text-gray-900">{r.tranche_label}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="tabular-nums">{formatCurrency(pesos(r.amount))}</span> },
    { key: "date", header: "Release Date", cell: (r) => formatDate(r.release_date) },
    { key: "ref", header: "Reference No.", hideBelow: "md", cell: (r) => r.reference_no ?? "—" },
    {
      key: "approval",
      header: "Approval",
      hideBelow: "lg",
      cell: (r) =>
        r.approval ? (
          <Link href={ROUTES.approvalRequest(r.approval.id)} className="text-blue-600 hover:underline">
            {r.approval.status === "pending" && r.approval.current_step ? `Awaiting ${r.approval.current_step.user.name}` : r.approval.status}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => (
        <span title={r.cancel_reason ?? undefined}>
          <StatusBadge status={r.status_label} />
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      cell: (r) => {
        if (!editable) return null;
        const items: MenuItem[] = [];
        if (r.status === "draft" || r.status === "rejected") {
          items.push({ label: "Edit", icon: Pencil, onSelect: () => setDialog({ kind: "release", release: r }) });
          items.push({ label: r.status === "rejected" ? "Submit again" : "Submit for approval", icon: Send, onSelect: () => setDialog({ kind: "submit", release: r }) });
        }
        if (r.status === "draft") items.push({ label: "Delete", icon: Trash2, danger: true, onSelect: () => setDialog({ kind: "deleteRelease", release: r }) });
        if (r.status === "released" || r.status === "rejected") items.push({ label: "Cancel tranche", icon: Ban, danger: true, onSelect: () => setDialog({ kind: "cancelRelease", release: r }) });
        return items.length ? (
          <DropdownMenu label={`Actions for ${r.tranche_label}`} triggerClassName="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-100" trigger={<MoreHorizontal className="size-4" />} items={items} />
        ) : null;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={a.allotment_no}
        description={a.purpose}
        extraCrumbs={[a.allotment_no]}
        actions={
          editable ? (
            <>
              <Button variant="outline" onClick={() => setDialog({ kind: "edit" })}>
                <Pencil className="size-4" /> Edit
              </Button>
              {a.next_tranche_label && !openRelease && (
                <Button onClick={() => setDialog({ kind: "release" })}>
                  <Plus className="size-4" /> Add {a.next_tranche_label}
                </Button>
              )}
              {neverSubmitted ? (
                <Button variant="danger" onClick={() => setDialog({ kind: "delete" })}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setDialog({ kind: "cancel" })} disabled={!!pendingApproval}>
                  <Ban className="size-4" /> Cancel allotment
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {!fyOpen && <FormAlert tone="info">{a.fiscal_year?.name ?? "The fiscal year"} is {a.fiscal_year?.status}: this allotment can be viewed but not changed.</FormAlert>}
      {cancelled && (
        <FormAlert>
          Cancelled on {a.cancelled_at ? formatDateTime(a.cancelled_at) : "—"}: {a.cancel_reason}
        </FormAlert>
      )}

      <div className="my-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Allotment Amount" value={formatCurrency(pesos(a.amount))} caption={a.status_label} icon={FileText} iconTone="red" />
        <StatCard label="Released" value={formatCurrency(pesos(a.released_amount))} caption="Approved tranches" icon={FileText} iconTone="green" />
        <StatCard label="Pending Approval" value={formatCurrency(pesos(a.pending_amount))} caption="Reserved until decided" icon={FileText} iconTone="blue" />
        <StatCard label="Remaining to Release" value={formatCurrency(pesos(a.unreleased_amount))} caption={a.next_tranche_label ? `Next: ${a.next_tranche_label}` : "Nothing left"} icon={FileText} iconTone="dark" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader title="Tranches" description="One open tranche at a time. Each is approved on its own." />
            <div className="mt-3 border-t border-gray-100">
              <DataTable dense columns={releaseColumns} rows={releases} rowKey={(r) => r.id} emptyTitle="No tranches" caption="Tranches" />
            </div>
          </Card>
          {pendingApproval && <ApprovalRequestPanel requestId={pendingApproval.id} compact />}
          <DocumentsCard allotment={a} canEdit={canManage && !cancelled} onDelete={(doc) => setDialog({ kind: "deleteDoc", doc })} />
        </div>
        <Card>
          <CardHeader title="Appropriation line" />
          <CardBody>
            {line ? (
              <dl className="space-y-1.5 text-sm">
                {(
                  [
                    ["Appropriation", line.appropriation_no],
                    ["Title", line.title ?? "—"],
                    ["Organization", line.organization ? `${line.organization.code} – ${line.organization.name}` : "—"],
                    ["PAP", line.prexc_item ? `${line.prexc_item.code} – ${line.prexc_item.description}` : "—"],
                    ["UACS object", line.uacs_object ? `${line.uacs_object.code} – ${line.uacs_object.description}` : "—"],
                    ["Fund source", line.fund_source ? `${line.fund_source.code} – ${line.fund_source.description}` : "—"],
                    ["Allotment class", line.allotment_class ? `${line.allotment_class.code} (${line.allotment_class.registry_code})` : "—"],
                    ["Period", `${formatDate(line.effectivity_date)} – ${line.expiry_date ? formatDate(line.expiry_date) : "no set end"}`],
                    ["Line amount", formatCurrency(pesos(line.amount))],
                    ["Created by", a.created_by?.name ?? "—"],
                    ["Created", formatDateTime(a.created_at)],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-right text-gray-900">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-gray-500">Line #{a.appropriation_id}</p>
            )}
          </CardBody>
        </Card>
      </div>

      {dialog?.kind === "edit" && <EditAllotmentModal allotment={a} onClose={() => setDialog(null)} />}
      {dialog?.kind === "release" && <ReleaseModal allotment={a} release={dialog.release} onClose={() => setDialog(null)} />}
      <PromptDialog
        open={dialog?.kind === "submit"}
        title={dialog?.kind === "submit" ? `Submit ${dialog.release.tranche_label} for approval?` : ""}
        description="Its amount is reserved until the last approver signs or someone rejects it."
        confirmLabel="Submit"
        reason={{ label: "Remarks for the approvers", optional: true }}
        onClose={() => setDialog(null)}
        onConfirm={async (remarks) => {
          if (dialog?.kind !== "submit") return;
          await submitRelease({ id: a.id, releaseId: dialog.release.id, remarks: remarks || undefined }).unwrap();
          notify("success", "Submitted for approval", dialog.release.tranche_label);
        }}
      />
      <PromptDialog
        open={dialog?.kind === "deleteRelease"}
        title="Delete this draft tranche?"
        confirmLabel="Delete"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== "deleteRelease") return;
          await deleteRelease({ id: a.id, releaseId: dialog.release.id }).unwrap();
          notify("success", "Tranche deleted");
        }}
      />
      <PromptDialog
        open={dialog?.kind === "cancelRelease"}
        title={dialog?.kind === "cancelRelease" ? `Cancel ${dialog.release.tranche_label}?` : ""}
        description="A released tranche's money goes back to the allotment."
        confirmLabel="Cancel tranche"
        danger
        reason={{ label: "Reason" }}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          if (dialog?.kind !== "cancelRelease") return;
          await cancelRelease({ id: a.id, releaseId: dialog.release.id, reason }).unwrap();
          notify("success", "Tranche cancelled");
        }}
      />
      <PromptDialog
        open={dialog?.kind === "cancel"}
        title={`Cancel ${a.allotment_no}?`}
        description="Cancels the allotment and every tranche. Released money goes back to the line, which can then be allotted again. This is final."
        confirmLabel="Cancel allotment"
        danger
        reason={{ label: "Reason" }}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await cancelAllotment({ id: a.id, reason }).unwrap();
          notify("success", "Allotment cancelled", a.allotment_no);
        }}
      />
      <PromptDialog
        open={dialog?.kind === "delete"}
        title={`Delete ${a.allotment_no}?`}
        description="Removes this draft with its tranches and documents. Its number is not reused."
        confirmLabel="Delete"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await deleteAllotment(a.id).unwrap();
          notify("success", "Allotment deleted", a.allotment_no);
          router.push(ROUTES.allotments);
        }}
      />
      <PromptDialog
        open={dialog?.kind === "deleteDoc"}
        title={dialog?.kind === "deleteDoc" ? `Remove ${dialog.doc.original_name}?` : ""}
        confirmLabel="Remove"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== "deleteDoc") return;
          await deleteDoc({ id: a.id, attachmentId: dialog.doc.id }).unwrap();
          notify("success", "Document removed");
        }}
      />
    </>
  );
}

function EditAllotmentModal({ allotment, onClose }: { allotment: AllotmentRecord; onClose: () => void }) {
  const notify = useNotify();
  const [update, { isLoading }] = useUpdateAllotmentRecordMutation();
  const [amount, setAmount] = useState(pesos(allotment.amount));
  const [purpose, setPurpose] = useState(allotment.purpose);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const floor = pesos(allotment.released_amount) + pesos(allotment.pending_amount);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!Number.isFinite(amount) || amount <= 0) e.amount = "Enter the allotment amount.";
    else if (amount < floor - 1e-9) e.amount = `The allotment amount can't be less than what is already released or pending approval (${formatCurrency(floor)}).`;
    if (!purpose.trim()) e.purpose = "Enter the purpose.";
    if (Object.keys(e).length) return setErrors(e);
    const input: { amount?: string; purpose?: string } = {};
    if (amount !== pesos(allotment.amount)) input.amount = toPesoString(amount);
    if (purpose.trim() !== allotment.purpose) input.purpose = purpose.trim();
    if (!Object.keys(input).length) return onClose();
    try {
      await update({ id: allotment.id, input }).unwrap();
      notify("success", "Allotment updated", allotment.allotment_no);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      else setGeneral(getErrorMessage(err));
    }
  };

  return (
    <Modal open onClose={isLoading ? () => undefined : onClose} title={`Edit ${allotment.allotment_no}`} footer={<><Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button><Button onClick={save} loading={isLoading}>Save</Button></>}>
      <div className="space-y-4">
        {general && <FormAlert>{general}</FormAlert>}
        <FormField label="Allotment amount" htmlFor="edit-amount" error={errors.amount} hint={`At least ${formatCurrency(floor)} and at most the line's amount.`}>
          <AmountInput id="edit-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
        </FormField>
        <FormField label="Purpose / Particulars" htmlFor="edit-purpose" error={errors.purpose}>
          <Textarea id="edit-purpose" rows={3} maxLength={500} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

function ReleaseModal({ allotment, release, onClose }: { allotment: AllotmentRecord; release?: AllotmentRelease; onClose: () => void }) {
  const notify = useNotify();
  const [add, addState] = useAddAllotmentReleaseMutation();
  const [update, updateState] = useUpdateAllotmentReleaseMutation();
  const busy = addState.isLoading || updateState.isLoading;
  const [values, setValues] = useState<ReleaseValues>(
    release
      ? { release_kind: release.release_kind, amount: pesos(release.amount), release_date: release.release_date, reference_no: release.reference_no ?? "" }
      : emptyRelease(allotment.appropriation?.effectivity_date ?? ""),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  // Editing a draft/rejected tranche: its own amount is not "pending", so it can use what is left plus itself.
  const left = pesos(allotment.unreleased_amount) + (release && release.status === "pending" ? pesos(release.amount) : 0);
  const period = allotment.appropriation ? { from: allotment.appropriation.effectivity_date, to: allotment.appropriation.expiry_date } : undefined;

  const save = async () => {
    const e = validateRelease(values, { left, period });
    if (Object.keys(e).length) return setErrors(e);
    const input: ReleaseInput = {
      release_kind: values.release_kind,
      amount: values.release_kind === "tranche" ? toPesoString(values.amount) : undefined,
      release_date: values.release_date,
      reference_no: values.reference_no.trim() || null,
    };
    try {
      if (release) await update({ id: allotment.id, releaseId: release.id, input }).unwrap();
      else await add({ id: allotment.id, input }).unwrap();
      notify("success", release ? "Tranche updated" : "Tranche added as draft");
      onClose();
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      setGeneral(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      size="xl"
      onClose={busy ? () => undefined : onClose}
      title={release ? `Edit ${release.tranche_label}` : `Add ${allotment.next_tranche_label ?? "tranche"}`}
      description="Saved as a draft. Submit it for approval from the tranche list."
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={save} loading={busy}>Save draft</Button></>}
    >
      <div className="space-y-4">
        {general && <FormAlert>{general}</FormAlert>}
        <ReleaseFields values={values} onChange={(p) => setValues((v) => ({ ...v, ...p }))} errors={errors} left={left} trancheLabel={release?.tranche_label ?? allotment.next_tranche_label} />
      </div>
    </Modal>
  );
}

function DocumentsCard({ allotment, canEdit, onDelete }: { allotment: AllotmentRecord; canEdit: boolean; onDelete: (doc: AllotmentAttachment) => void }) {
  const notify = useNotify();
  const [upload, { isLoading }] = useUploadAllotmentAttachmentMutation();
  const input = useRef<HTMLInputElement>(null);
  const docs = allotment.attachments ?? [];
  const removable = allotment.status === "draft" && !(allotment.releases ?? []).some((r) => r.status === "pending");

  const onFile = async (file?: File) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!DOC_TYPES.includes(file.type)) return notify("error", "Unsupported file", "Use a PDF, an Excel workbook (.xlsx), or a JPEG or PNG image.");
    if (file.size > 5 * 1024 * 1024) return notify("error", "File too large", "Each document can be at most 5 MB.");
    try {
      await upload({ id: allotment.id, file }).unwrap();
      notify("success", "Document uploaded", file.name);
    } catch (err) {
      notify("error", "Unable to upload", getErrorMessage(err));
    }
  };

  const download = async (doc: AllotmentAttachment) => {
    try {
      saveDownloadedFile(await allotmentRecordsService.downloadAttachment(doc));
    } catch (err) {
      notify("error", "Unable to download", getErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Supporting documents"
        description="PDF, .xlsx, JPEG or PNG; up to 5 MB each and 20 per allotment. They can be removed only while the allotment is a draft."
        action={
          canEdit ? (
            <>
              <input ref={input} type="file" className="hidden" accept=".pdf,.xlsx,.jpg,.jpeg,.png" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button variant="outline" size="sm" onClick={() => input.current?.click()} loading={isLoading} disabled={docs.length >= 20}>
                <Upload className="size-3.5" /> Upload
              </Button>
            </>
          ) : undefined
        }
      />
      <CardBody>
        {docs.length ? (
          <ul className="divide-y divide-gray-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                <FileText className="size-5 shrink-0 text-gray-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{d.original_name}</span>
                  <span className="text-xs text-gray-500">
                    {formatFileSize(d.size)} · {formatDateTime(d.created_at)}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => download(d)} aria-label={`Download ${d.original_name}`}>
                  <Download className="size-4" />
                </Button>
                {canEdit && removable && (
                  <Button variant="ghost" size="sm" onClick={() => onDelete(d)} aria-label={`Remove ${d.original_name}`}>
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No documents yet.</p>
        )}
      </CardBody>
    </Card>
  );
}
