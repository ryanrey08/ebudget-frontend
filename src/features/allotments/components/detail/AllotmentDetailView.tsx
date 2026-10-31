"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, Ban, Check, ChevronLeft, CircleAlert, MessageSquareText, RotateCcw, Send, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { FormAlert } from "@/components/forms/FormAlert";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { ROUTES } from "@/lib/constants/routes";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { ROLE_LABELS } from "@/features/auth/types";
import { useGetAppropriationLookupsQuery } from "@/features/appropriations/services/appropriationsApi";
import {
  useAllotmentWorkflowMutation,
  useAttachAllotmentDocumentMutation,
  useDeleteAllotmentMutation,
  useGetAllotmentQuery,
} from "../../services/allotmentsApi";
import type { Allotment, WorkflowAction, WorkflowStep } from "../../types";
import { STEP_PAGES, allotmentHref, currentStep, stepChecklist } from "../../workflow";
import { ApprovalStepper } from "../ApprovalStepper";
import { AllotmentStatusBadge } from "../AllotmentStatusBadge";
import { AllotmentInfoCard, BalanceCard, CardTitle, DocumentsCard } from "./InfoCards";
import { AuditTrailCard, ChecklistCard } from "./WorkflowPanels";

export function AllotmentDetailView({ id }: { id: string }) {
  const router = useRouter();
  const notify = useNotify();
  const user = useAppSelector(selectCurrentUser);
  const { data, isLoading, error, refetch } = useGetAllotmentQuery(id);
  const lookups = useGetAppropriationLookupsQuery();
  const [runWorkflow, { isLoading: acting, originalArgs }] = useAllotmentWorkflowMutation();
  const [attach, { isLoading: attaching }] = useAttachAllotmentDocumentMutation();
  const [deleteAllotment, { isLoading: deleting }] = useDeleteAllotmentMutation();
  const [remarks, setRemarks] = useState("");
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [mds, setMds] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Allotment" />
        <Skeleton className="h-[640px] w-full rounded-xl" />
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHeader title="Allotment" />
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      </>
    );
  }

  const a = data.allotment;
  if (a.workflowType === "registry") {
    return (
      <>
        <PageHeader title={a.allotmentNo} />
        <Card className="p-6 text-sm text-gray-700">
          This allotment was encoded from its allotment class page.{" "}
          <Link href={allotmentHref(a)} className="font-medium text-blue-600 hover:underline">Open it there</Link>.
        </Card>
      </>
    );
  }
  const step = currentStep(a);
  const approvalStep = step && step !== "prepared" && step !== "submit" ? step : undefined;
  const page = approvalStep ? STEP_PAGES[approvalStep] : undefined;
  const checklist = approvalStep ? stepChecklist(approvalStep, data) : [];
  const autoOk = checklist.every((c) => c.kind === "manual" || c.ok);
  const manualOk = checklist.every((c) => c.kind === "auto" || confirmed.has(c.label));
  const fundName = lookups.data?.fundSources.find((f) => f.code === a.fundSource)?.name ?? "";
  const busy = acting || deleting;

  const title =
    page?.title ??
    (a.status === "Released" || a.status === "Partial"
      ? "Allotment Released"
      : a.status === "Rejected"
        ? "Allotment Rejected"
        : a.status === "Returned"
          ? "Returned for Revision"
          : "Allotment Draft");
  const description =
    page?.description ??
    (a.status === "Released" || a.status === "Partial"
      ? "The allotment has completed the approval workflow and was released."
      : "Review the allotment and submit it for approval.");

  const act = async (action: WorkflowAction) => {
    setFormError(null);
    if ((action === "return" || action === "reject") && !remarks.trim()) {
      setFormError({ field: "remarks", message: "Add remarks explaining why the allotment is being returned or rejected." });
      document.getElementById("step-remarks")?.focus();
      return;
    }
    if (action === "reject" && !window.confirm(`Reject ${a.allotmentNo}? This ends the approval workflow.`)) return;
    try {
      const res = await runWorkflow({
        id: a.id,
        action,
        remarks: remarks.trim() || undefined,
        mdsReferenceNo: approvalStep === "release" ? mds : undefined,
        releaseDate: approvalStep === "release" ? releaseDate || a.release?.releaseDate || a.releaseDate : undefined,
      }).unwrap();
      const next = res.allotment;
      const messages: Record<WorkflowAction, string> = {
        saveRemarks: "Remarks saved.",
        submit: "Submitted to the Budget Head for review.",
        approve: next.status === "Released" || next.status === "Partial" ? `Released ${formatCurrency(next.released)}.` : "Approved and forwarded to the next approver.",
        return: "Returned to the Budget Officer for revision.",
        reject: "The allotment was rejected.",
      };
      notify(action === "reject" ? "warning" : "success", `${a.allotmentNo} updated`, messages[action]);
      setRemarks("");
      setConfirmed(new Set());
      setMds("");
    } catch (err) {
      const field = isApiError(err) && err.fieldErrors ? Object.keys(err.fieldErrors)[0] : undefined;
      setFormError({ field, message: isApiError(err) && field ? err.fieldErrors![field] : getErrorMessage(err) });
    }
  };

  const onAddDocument = async (file: File) => {
    try {
      await attach({ id: a.id, file }).unwrap();
      notify("success", "Document added", file.name);
    } catch (err) {
      notify("error", "Unable to add document", getErrorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete ${a.allotmentNo}?`)) return;
    try {
      await deleteAllotment(a.id).unwrap();
      notify("success", "Allotment deleted", a.allotmentNo);
      router.push(ROUTES.allotments);
    } catch (err) {
      notify("error", "Unable to delete", getErrorMessage(err));
    }
  };

  const lastStopped = a.workflow.find((s) => s.status === "returned" || s.status === "rejected");

  return (
    <>
      <PageHeader title={title} description={description} extraCrumbs={[a.allotmentNo]} />

      <Card className="mb-5 px-3 py-5 sm:px-6">
        <ApprovalStepper steps={a.workflow} />
      </Card>

      {lastStopped && (a.status === "Returned" || a.status === "Rejected") && (
        <div className="mb-5">
          <FormAlert>
            <p className="font-medium">
              {a.status === "Returned" ? "Returned for revision" : "Rejected"} by {lastStopped.actorName} ({lastStopped.actorPosition}) on{" "}
              {lastStopped.actedAt ? formatDateTime(lastStopped.actedAt) : "—"}
            </p>
            {lastStopped.remarks && <p className="mt-0.5">“{lastStopped.remarks}”</p>}
          </FormAlert>
        </div>
      )}
      {(a.status === "Released" || a.status === "Partial") && (
        <div className="mb-5">
          <FormAlert tone="success">
            {a.allotmentNo} was released on {a.release?.releasedAt ? formatDateTime(a.release.releasedAt) : "—"} ({a.release?.releaseNo},
            MDS {a.release?.mdsReferenceNo}). Released amount: {formatCurrency(a.released)}
            {a.status === "Partial" ? ` of ${formatCurrency(a.amount)} (partial tranche).` : "."}
          </FormAlert>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-5">
          <AllotmentInfoCard allotment={a} fundName={fundName} />
          <DocumentsCard documents={a.documents} onAdd={approvalStep === "release" || step === "prepared" ? onAddDocument : undefined} adding={attaching} />
          {(approvalStep === "release" || a.status === "Released" || a.status === "Partial") && <SignatoriesCard steps={a.workflow} />}
          {page && (
            <Card>
              <CardTitle icon={page.certification ? Award : MessageSquareText}>{page.remarksTitle}</CardTitle>
              <div className="space-y-2 p-5">
                {page.certification && <p className="text-sm text-gray-700">{page.certification}</p>}
                <label htmlFor="step-remarks" className="block text-sm text-gray-600">{page.remarksLabel}</label>
                <Textarea
                  id="step-remarks"
                  rows={3}
                  maxLength={500}
                  value={remarks}
                  placeholder={page.remarksPlaceholder}
                  invalid={formError?.field === "remarks"}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <p className="text-right text-xs text-gray-500">{remarks.length}/500 · required when returning or rejecting</p>
              </div>
            </Card>
          )}
          {step === "prepared" && a.status !== "Rejected" && (
            <Card>
              <CardTitle icon={MessageSquareText}>Submission Notes</CardTitle>
              <div className="p-5">
                <label htmlFor="step-remarks" className="sr-only">Notes</label>
                <Textarea id="step-remarks" rows={3} maxLength={500} value={remarks} placeholder="Optional notes for the Budget Head" onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Balance, checklist and history">
          <BalanceCard balance={data.appropriation} />
          {(approvalStep === "release" || a.release) && (
            <ReleaseCard
              allotment={a}
              editable={approvalStep === "release"}
              mds={mds}
              onMds={setMds}
              releaseDate={releaseDate || a.release?.releaseDate || a.releaseDate}
              onReleaseDate={setReleaseDate}
              mdsInvalid={formError?.field === "mdsReferenceNo"}
            />
          )}
          {page && (
            <ChecklistCard
              title={page.checklistTitle}
              items={checklist}
              confirmed={confirmed}
              onToggle={(label) =>
                setConfirmed((prev) => {
                  const next = new Set(prev);
                  if (next.has(label)) next.delete(label);
                  else next.add(label);
                  return next;
                })
              }
            />
          )}
          <AuditTrailCard steps={a.workflow} />
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t border-gray-200 bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {formError && (
          <div className="mb-3">
            <FormAlert>{formError.message}</FormAlert>
          </div>
        )}
        {approvalStep && !autoOk && (
          <p className="mb-3 flex items-center gap-2 text-sm text-red-700">
            <CircleAlert className="size-4" aria-hidden /> Some checks failed. Return the allotment for revision or reject it.
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            {approvalStep === "release" || !approvalStep ? (
              <Link href={ROUTES.allotments} className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <ChevronLeft className="size-4" /> Back to Allotments
              </Link>
            ) : null}
            {approvalStep && approvalStep !== "release" && (
              <Button variant="outline" size="lg" onClick={() => act("return")} loading={acting && originalArgs?.action === "return"} disabled={busy}>
                <X className="size-4" /> Return for Revision
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {user && approvalStep && (
              <span className="text-xs text-gray-500">
                Acting as {user.firstName} {user.lastName} ({ROLE_LABELS[user.role]}). Demo mode does not restrict approvers by role.
              </span>
            )}
            {approvalStep === "release" && (
              <Button variant="outline" size="lg" onClick={() => act("return")} loading={acting && originalArgs?.action === "return"} disabled={busy}>
                <RotateCcw className="size-4" /> Return for Revision
              </Button>
            )}
            {approvalStep && approvalStep !== "release" && (
              <Button variant="outline" size="lg" onClick={() => act("reject")} loading={acting && originalArgs?.action === "reject"} disabled={busy}>
                <Ban className="size-4" /> Reject
              </Button>
            )}
            {approvalStep && page && (
              <Button size="lg" onClick={() => act("approve")} loading={acting && originalArgs?.action === "approve"} disabled={busy || !autoOk || !manualOk} title={!manualOk ? "Confirm the checklist items first" : undefined}>
                <Check className="size-4" /> {page.approveLabel}
              </Button>
            )}
            {step === "prepared" && (a.status === "Draft" || a.status === "Returned") && (
              <>
                <Button variant="danger" size="lg" onClick={onDelete} loading={deleting} disabled={busy}>
                  <Trash2 className="size-4" /> Delete
                </Button>
                <Button size="lg" onClick={() => act("submit")} loading={acting && originalArgs?.action === "submit"} disabled={busy}>
                  <Send className="size-4" /> {a.status === "Returned" ? "Resubmit for Approval" : "Submit for Approval"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ReleaseCard({
  allotment: a,
  editable,
  mds,
  onMds,
  releaseDate,
  onReleaseDate,
  mdsInvalid,
}: {
  allotment: Allotment;
  editable: boolean;
  mds: string;
  onMds: (v: string) => void;
  releaseDate: string;
  onReleaseDate: (v: string) => void;
  mdsInvalid: boolean;
}) {
  const row = "grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-2 py-1.5";
  return (
    <Card>
      <CardTitle icon={Send}>Release Details</CardTitle>
      <dl className="p-5 text-sm">
        <div className={row}><dt className="text-gray-600">Release No.</dt><dd>{a.release?.releaseNo ?? "—"}</dd></div>
        <div className={row}>
          <dt><label htmlFor="release-date" className="text-gray-600">Release Date</label></dt>
          <dd>{editable ? <Input id="release-date" type="date" value={releaseDate} onChange={(e) => onReleaseDate(e.target.value)} className="h-9" /> : formatDate(a.release?.releaseDate ?? a.releaseDate)}</dd>
        </div>
        <div className={row}><dt className="text-gray-600">Release Amount</dt><dd className="font-semibold">{formatCurrency(a.releaseAmount)}</dd></div>
        <div className={row}>
          <dt><label htmlFor="mds-ref" className="text-gray-600">MDS Reference No.{editable && <span className="text-brand-600"> *</span>}</label></dt>
          <dd>{editable ? <Input id="mds-ref" value={mds} onChange={(e) => onMds(e.target.value)} placeholder="e.g. MDS-2026-01234" invalid={mdsInvalid} className="h-9" /> : a.release?.mdsReferenceNo ?? "—"}</dd>
        </div>
        <div className={row}><dt className="text-gray-600">Status</dt><dd>{editable ? <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-800">Certified and Approved for Release</span> : <AllotmentStatusBadge status={a.status} />}</dd></div>
        <div className={row}><dt className="text-gray-600">Date Released</dt><dd>{a.release?.releasedAt ? formatDateTime(a.release.releasedAt) : "-"}</dd></div>
      </dl>
    </Card>
  );
}

function SignatoriesCard({ steps }: { steps: WorkflowStep[] }) {
  const cert = steps.find((s) => s.key === "certification");
  const release = steps.find((s) => s.key === "release");
  const items = [
    { title: "Certified by Head of Agency", step: cert },
    { title: "Approved for Release", step: release },
  ];
  return (
    <Card>
      <CardTitle icon={Award}>Certification and Approval</CardTitle>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {items.map(({ title, step }) => {
          const done = step?.status === "completed";
          return (
            <div key={title} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-900">{title}</p>
                <span className={done ? "rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800" : "rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"}>
                  {done ? "Completed" : "Pending"}
                </span>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex gap-2"><dt className="w-16 text-gray-500">Name</dt><dd>{step?.actorName ?? "—"}</dd></div>
                <div className="flex gap-2"><dt className="w-16 text-gray-500">Position</dt><dd>{step?.actorPosition ?? "—"}</dd></div>
                <div className="flex gap-2"><dt className="w-16 text-gray-500">Date</dt><dd>{step?.actedAt ? formatDateTime(step.actedAt) : "—"}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
