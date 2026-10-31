"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, ChevronLeft, CircleDot, History, MessageSquareText, Pencil, PenLine, RotateCcw, Save, Send, Trash2, X } from "lucide-react";
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
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { ROLE_LABELS } from "@/features/auth/types";
import { useGetAppropriationLookupsQuery } from "@/features/appropriations/services/appropriationsApi";
import { CardTitle, DocumentsCard } from "@/features/allotments/components/detail/InfoCards";
import { useDeleteObligationMutation, useGetObligationQuery, useObligationWorkflowMutation } from "../../services/obligationsApi";
import type { ObligationAction } from "../../types";
import { CERTIFICATION_TEXT, OBLIGATION_STEP_PAGES, canEditObligation, obligationCurrentStep } from "../../workflow";
import { AllotmentBalanceCard, LineItemsCard, ObligationInfoCard, WorkflowTimelineCard } from "./ObligationCards";
import { ObligationStepper } from "./ObligationStepper";

export function ObligationDetailView({ id }: { id: string }) {
  const router = useRouter();
  const notify = useNotify();
  const user = useAppSelector(selectCurrentUser);
  const { data, isLoading, error, refetch } = useGetObligationQuery(id);
  const lookups = useGetAppropriationLookupsQuery();
  const [runWorkflow, { isLoading: acting, originalArgs }] = useObligationWorkflowMutation();
  const [deleteObligation, { isLoading: deleting }] = useDeleteObligationMutation();
  const [remarks, setRemarks] = useState("");
  const [certified, setCertified] = useState(false);
  const [signature, setSignature] = useState("");
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);

  const step = data ? obligationCurrentStep(data.obligation) : undefined;
  const draftRemarks = data?.obligation.workflow.find((s) => s.status === "current")?.draftRemarks;
  // Load saved draft remarks when the step changes.
  useEffect(() => {
    setRemarks(draftRemarks ?? "");
    setCertified(false);
    setSignature("");
    setFormError(null);
  }, [step, draftRemarks]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Obligation" />
        <Skeleton className="h-[640px] w-full rounded-xl" />
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHeader title="Obligation" />
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      </>
    );
  }

  const o = data.obligation;
  const page = step ? OBLIGATION_STEP_PAGES[step] : undefined;
  const fundName = lookups.data?.fundSources.find((f) => f.code === o.fundSource)?.name ?? "";
  const busy = acting || deleting;
  const stopped = o.workflow.find((s) => s.status === "returned" || s.status === "rejected");
  const isActing = (a: ObligationAction) => acting && originalArgs?.action === a;

  const title = page?.title ?? (o.status === "Released" ? "Obligation Released" : o.status === "Cancelled" ? "Obligation Cancelled" : o.status === "Returned" ? "Returned for Revision" : "Obligation Details");
  const description = page?.description ?? (o.status === "Released" ? "The obligation completed the approval workflow and was approved for release." : "Obligation details and approval history.");

  const act = async (action: ObligationAction) => {
    setFormError(null);
    const needs = action === "return" || action === "reject" || action === "back" || (action === "approve" && page?.remarksRequired);
    if (needs && !remarks.trim()) {
      setFormError({ field: "remarks", message: action === "approve" ? "Remarks are required for this step." : "Add remarks explaining the action." });
      document.getElementById("step-remarks")?.focus();
      return;
    }
    if (action === "approve" && step === "certification") {
      if (!certified) return setFormError({ field: "certify", message: "Tick the certification statement first." });
      if (!signature.trim()) return setFormError({ field: "signature", message: "Type your full name as your digital signature." });
    }
    if (action === "reject" && !window.confirm(`Reject ${o.referenceNo}? The obligation will be cancelled.`)) return;
    try {
      const res = await runWorkflow({ id: o.id, action, remarks: remarks.trim() || undefined, signature: signature.trim() || undefined }).unwrap();
      const s = res.obligation.status;
      const messages: Record<ObligationAction, string> = {
        saveRemarks: "Your remarks were saved as a draft.",
        submit: "Submitted to the Budget Head for review.",
        approve: s === "Released" ? `Certified and approved for release (${formatCurrency(o.amount)}).` : "Approved and forwarded to the next approver.",
        back: "Sent back to the previous approver.",
        return: "Returned to the encoder for revision.",
        reject: "The obligation was rejected and cancelled.",
      };
      notify(action === "reject" ? "warning" : "success", o.referenceNo, messages[action]);
    } catch (err) {
      const field = isApiError(err) && err.fieldErrors ? Object.keys(err.fieldErrors)[0] : undefined;
      setFormError({ field, message: isApiError(err) && field ? err.fieldErrors![field] : getErrorMessage(err) });
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete ${o.referenceNo}?`)) return;
    try {
      await deleteObligation(o.id).unwrap();
      notify("success", "Obligation deleted", o.referenceNo);
      router.push(ROUTES.obligationManagement);
    } catch (err) {
      notify("error", "Unable to delete", getErrorMessage(err));
    }
  };

  const outline = "inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50";
  const approverStep = step === "review" || step === "accountant" || step === "certification";

  return (
    <>
      <PageHeader title={title} description={description} extraCrumbs={[o.referenceNo]} />
      <Card className="mb-5 px-3 py-5 sm:px-6"><ObligationStepper steps={o.workflow} /></Card>

      {stopped && (o.status === "Returned" || o.status === "Cancelled") && (
        <div className="mb-5">
          <FormAlert>
            <p className="font-medium">
              {o.status === "Returned" ? "Returned for revision" : "Rejected"} by {stopped.actorName} ({stopped.actorPosition}) on {stopped.actedAt ? formatDateTime(stopped.actedAt) : "—"}
            </p>
            {stopped.remarks && <p className="mt-0.5">“{stopped.remarks}”</p>}
          </FormAlert>
        </div>
      )}
      {o.status === "Released" && (
        <div className="mb-5">
          <FormAlert tone="success">{o.referenceNo} was certified and approved for release of {formatCurrency(o.amount)}.</FormAlert>
        </div>
      )}
      {o.workflow.some((s) => s.status === "current" && s.remarks?.startsWith("Sent back")) && (
        <p className="mb-5 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <CircleDot className="size-4" aria-hidden /> {o.workflow.find((s) => s.status === "current")?.remarks}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-5">
          <ObligationInfoCard
            obligation={o}
            fundName={fundName}
            action={
              step === "submit" || step === "encode" ? (
                <Link href={ROUTES.editObligation(o.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <Pencil className="size-3.5" /> Edit Details
                </Link>
              ) : (
                <button type="button" onClick={() => document.getElementById("approval-workflow")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <History className="size-3.5" /> View History
                </button>
              )
            }
          />
          <LineItemsCard obligation={o} />
          <DocumentsCard documents={o.documents} />
          <div className="grid gap-5 lg:grid-cols-2">
            {step === "certification" && (
              <Card>
                <CardTitle icon={PenLine}>Certification and Approval</CardTitle>
                <div className="space-y-3 p-5 text-sm">
                  <label className="flex items-start gap-2.5 text-gray-700">
                    <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-blue-600" checked={certified} onChange={(e) => setCertified(e.target.checked)} />
                    {CERTIFICATION_TEXT}
                  </label>
                  <div>
                    <label htmlFor="signature" className="block text-sm font-medium text-gray-700">Digital Signature <span className="text-brand-600">*</span></label>
                    <div className="mt-1.5 flex gap-2">
                      <Input id="signature" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type your full name" invalid={formError?.field === "signature"} className="font-serif text-lg italic" />
                      <Button variant="outline" onClick={() => setSignature("")} disabled={!signature}><X className="size-4" /> Clear</Button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {user ? `${user.firstName} ${user.lastName} · ${ROLE_LABELS[user.role]}` : ""} · {formatDateTime(new Date().toISOString())}
                    </p>
                  </div>
                </div>
              </Card>
            )}
            {page && (
              <Card className={step === "certification" ? "" : "lg:col-span-2"}>
                <CardTitle icon={MessageSquareText}>{page.remarksTitle}</CardTitle>
                <div className="space-y-1.5 p-5">
                  <label htmlFor="step-remarks" className="block text-sm text-gray-600">
                    Remarks {page.remarksRequired ? <span className="text-brand-600">(required)</span> : "(optional)"}
                  </label>
                  <Textarea id="step-remarks" rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} invalid={formError?.field === "remarks"} placeholder={step === "submit" ? "e.g. Please review and approve." : "Remarks / comments"} />
                  <p className="text-right text-xs text-gray-500">{remarks.length}/500{approverStep ? " · required when returning, sending back or rejecting" : ""}</p>
                </div>
              </Card>
            )}
          </div>
        </div>
        <aside className="min-w-0 space-y-5" aria-label="Allotment balance and approval workflow">
          <AllotmentBalanceCard balance={data.allotment} current={o.status === "Cancelled" ? 0 : o.amount} />
          <WorkflowTimelineCard steps={o.workflow} id="approval-workflow" />
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t border-gray-200 bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {formError && <div className="mb-3"><FormAlert>{formError.message}</FormAlert></div>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            {step === "submit" && (
              <Link href={ROUTES.editObligation(o.id)} className={outline}><ChevronLeft className="size-4" /> Back to Edit</Link>
            )}
            {(step === "accountant" || step === "certification") && (
              <Button variant="outline" size="lg" onClick={() => act("back")} loading={isActing("back")} disabled={busy}>
                <ChevronLeft className="size-4" /> Back to Previous Step
              </Button>
            )}
            {approverStep && (
              <Button variant="outline" size="lg" onClick={() => act("return")} loading={isActing("return")} disabled={busy}>
                <RotateCcw className="size-4" /> Return for Revision
              </Button>
            )}
            {!page && (
              <Link href={ROUTES.obligationManagement} className={outline}><ChevronLeft className="size-4" /> Back to Obligations</Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {user && approverStep && (
              <span className="max-w-xs text-xs text-gray-500">
                Acting as {user.firstName} {user.lastName} ({ROLE_LABELS[user.role]}). Demo mode does not restrict approvers by role.
              </span>
            )}
            {approverStep && (
              <Button variant="ghost" size="lg" onClick={() => act("reject")} loading={isActing("reject")} disabled={busy} className="text-red-700 hover:bg-red-50">
                <Ban className="size-4" /> Reject
              </Button>
            )}
            {page && (
              <Button variant="outline" size="lg" onClick={() => act("saveRemarks")} loading={isActing("saveRemarks")} disabled={busy}>
                <Save className="size-4" /> Save as Draft
              </Button>
            )}
            {page && (
              <Button size="lg" onClick={() => act(step === "submit" ? "submit" : "approve")} loading={isActing("submit") || isActing("approve")} disabled={busy}>
                {step === "submit" ? <Send className="size-4" /> : <Check className="size-4" />} {page.approveLabel}
              </Button>
            )}
            {step === "encode" && canEditObligation(o) && (
              <>
                <Button variant="danger" size="lg" onClick={onDelete} loading={deleting} disabled={busy}><Trash2 className="size-4" /> Delete</Button>
                <Link href={ROUTES.editObligation(o.id)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700">
                  <Pencil className="size-4" /> Edit and Resubmit
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
