"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, CircleDot, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { AuthorizedImage } from "@/components/backend/AuthorizedImage";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { PromptDialog } from "@/components/backend/PromptDialog";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { formatDateTime } from "@/lib/utils/format";
import { approvalRequestsService } from "@/services/backend";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useApproveApprovalStepMutation, useGetApprovalRequestQuery, useRejectApprovalStepMutation } from "../services/approvalsApi";
import type { ApprovalRequest, ApprovalRequestStep } from "../types";
import { SignaturePad } from "./SignaturePad";

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ApprovalRequestView({ requestId, backHref }: { requestId: string; backHref?: string }) {
  return (
    <>
      <PageHeader title="Approval Request" description="Each step is approved or rejected in turn by its own user." extraCrumbs={["Approval"]} />
      <BackendRequired>
        <ApprovalRequestPanel requestId={requestId} backHref={backHref} />
      </BackendRequired>
    </>
  );
}

/** The request's steps and, for the current step's user, the approve/reject actions. Also embedded in the allotment page. */
export function ApprovalRequestPanel({ requestId, backHref, compact }: { requestId: string; backHref?: string; compact?: boolean }) {
  const request = useGetApprovalRequestQuery(requestId);
  const me = useAppSelector(selectCurrentUser);
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  if (request.error) return <ErrorState error={request.error} onRetry={request.refetch} />;
  const r = request.data;
  if (!r) return <Skeleton className="h-48 w-full" />;
  const current = r.steps.find((s) => s.id === r.current_step_id) ?? null;
  const myTurn = !!current && current.user.id === me?.id && r.status === "pending";

  return (
    <Card>
      <CardHeader
        title={`${r.module_label} approval`}
        description={`Submitted by ${r.submitted_by.name} on ${formatDateTime(r.submitted_at)}${r.remarks ? ` — “${r.remarks}”` : ""}`}
        action={<StatusBadge status={label(r.status)} />}
      />
      <CardBody className="space-y-4">
        <ol className="space-y-3">
          {r.steps.map((s) => (
            <StepRow key={s.id} request={r} step={s} current={s.id === r.current_step_id} />
          ))}
        </ol>
        {myTurn && current && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <p className="w-full text-sm text-gray-600">
              It&apos;s your turn: <span className="font-medium">{current.name}</span>
              {current.requires_signature && current.signatory && <> (you sign as {current.signatory.position})</>}.
            </p>
            <Button onClick={() => setActing("approve")}>Approve</Button>
            <Button variant="danger" onClick={() => setActing("reject")}>
              Reject
            </Button>
          </div>
        )}
        {!myTurn && current && r.status === "pending" && (
          <p className="text-sm text-gray-500">
            Waiting for {current.user.name} ({current.name}).
          </p>
        )}
        {!compact && backHref && (
          <Link href={backHref} className="inline-block text-sm font-medium text-blue-600 hover:underline">
            ← Back to the record
          </Link>
        )}
      </CardBody>
      {current && acting === "approve" && <ApproveModal request={r} step={current} onClose={() => setActing(null)} />}
      {current && <RejectDialog open={acting === "reject"} request={r} step={current} onClose={() => setActing(null)} />}
    </Card>
  );
}

function StepRow({ request, step, current }: { request: ApprovalRequest; step: ApprovalRequestStep; current: boolean }) {
  const Icon = step.status === "approved" ? CheckCircle2 : step.status === "rejected" ? XCircle : current ? CircleDot : Circle;
  const tone = step.status === "approved" ? "text-green-600" : step.status === "rejected" ? "text-red-600" : current ? "text-amber-500" : "text-gray-300";
  return (
    <li className="flex gap-3">
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-gray-900">
          {step.sequence}. {step.name} <span className="font-normal text-gray-500">— {step.user.name}</span>
        </p>
        <p className="text-xs text-gray-500">
          {label(step.status)}
          {step.acted_at && ` on ${formatDateTime(step.acted_at)}`}
          {step.signed_position && ` · signed as ${step.signed_position}`}
          {!step.acted_at && step.requires_signature && step.signatory && ` · needs an e-signature (${step.signatory.position})`}
        </p>
        {step.remarks && <p className="mt-1 text-gray-700">“{step.remarks}”</p>}
        {step.signature_url && (
          <AuthorizedImage
            load={() => approvalRequestsService.signature(step.signature_url as string)}
            cacheKey={`${request.id}-${step.id}`}
            alt={`Signature of ${step.user.name}`}
            className="mt-2 h-14 max-w-48 rounded border border-gray-200 bg-white object-contain"
          />
        )}
      </div>
    </li>
  );
}

function ApproveModal({ request, step, onClose }: { request: ApprovalRequest; step: ApprovalRequestStep; onClose: () => void }) {
  const notify = useNotify();
  const [approve, { isLoading }] = useApproveApprovalStepMutation();
  const [signature, setSignature] = useState<Blob | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (step.requires_signature && !signature) return setError("Draw or upload your e-signature to approve this step.");
    setError("");
    try {
      const res = await approve({ id: request.id, stepId: step.id, signature: step.requires_signature ? signature : null, remarks }).unwrap();
      notify("success", res.status === "approved" ? "Approved: the request is complete" : "Step approved", step.name);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={isLoading ? () => undefined : onClose}
      title={`Approve: ${step.name}`}
      description={step.requires_signature && step.signatory ? `This step is signed as "${step.signatory.position}".` : "This step takes no e-signature."}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isLoading}>
            Approve
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        {step.requires_signature && (
          <FormField label="E-signature" htmlFor="signature" required>
            <SignaturePad onChange={setSignature} />
          </FormField>
        )}
        <FormField label="Remarks" htmlFor="approve-remarks" hint="Optional, up to 500 characters.">
          <Textarea id="approve-remarks" rows={2} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

function RejectDialog({ open, request, step, onClose }: { open: boolean; request: ApprovalRequest; step: ApprovalRequestStep; onClose: () => void }) {
  const notify = useNotify();
  const [reject] = useRejectApprovalStepMutation();
  return (
    <PromptDialog
      open={open}
      title={`Reject: ${step.name}`}
      description="Rejecting any step rejects the whole request. The record can be corrected and submitted again."
      confirmLabel="Reject"
      danger
      reason={{ label: "Reason" }}
      onClose={onClose}
      onConfirm={async (remarks) => {
        await reject({ id: request.id, stepId: step.id, remarks }).unwrap();
        notify("success", "Request rejected", step.name);
      }}
    />
  );
}

