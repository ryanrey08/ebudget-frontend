"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, ChevronLeft, ClipboardCheck, MessageSquareText, Printer, X, FileCheck2, FileText, History, ListChecks, Pencil, RotateCcw, Save, Send, Trash2, Upload, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { FormAlert } from "@/components/forms/FormAlert";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import type { AllotmentClassMeta } from "@/lib/constants/allotment-classes";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/utils/format";
import { ROLE_LABELS } from "@/features/auth/types";
import { useGetAppropriationLookupsQuery } from "@/features/appropriations/services/appropriationsApi";
import {
  useAllotmentWorkflowMutation,
  useAttachAllotmentDocumentMutation,
  useDeleteAllotmentMutation,
  useGetAllotmentQuery,
  useGetRegistryLookupsQuery,
  useRemoveAllotmentDocumentMutation,
} from "@/features/allotments/services/allotmentsApi";
import type { WorkflowAction } from "@/features/allotments/types";
import { ApprovalStepper } from "@/features/allotments/components/ApprovalStepper";
import { CardTitle } from "@/features/allotments/components/detail/InfoCards";
import { REGISTRY_STEP_LABELS, REGISTRY_STEP_PAGES, registryChecklist } from "../../registryWorkflow";
import { registryConfig } from "../../registryConfig";
import { RegistryStatusBadge } from "./RegistryStatusBadge";

type Decision = "approve" | "return" | "reject";

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-2 border-b border-gray-50 py-1.5 text-sm last:border-0">
      <dt className="text-blue-900">{label}</dt>
      <dd className="text-gray-900">{children || "—"}</dd>
    </div>
  );
}

export function RegistryAllotmentDetail({ meta, id }: { meta: AllotmentClassMeta; id: string }) {
  const router = useRouter();
  const notify = useNotify();
  const user = useAppSelector(selectCurrentUser);
  const { data, isLoading, error, refetch } = useGetAllotmentQuery(id);
  const lookups = useGetRegistryLookupsQuery(meta.code);
  const appLookups = useGetAppropriationLookupsQuery();
  const [run, { isLoading: acting, originalArgs }] = useAllotmentWorkflowMutation();
  const [attach, { isLoading: attaching }] = useAttachAllotmentDocumentMutation();
  const [removeDoc] = useRemoveAllotmentDocumentMutation();
  const [deleteAllotment, { isLoading: deleting }] = useDeleteAllotmentMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const config = registryConfig(meta.slug);

  const [decision, setDecision] = useState<Decision>("approve");
  const [remarks, setRemarks] = useState("");
  const [signature, setSignature] = useState("");
  const [nextApprover, setNextApprover] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);

  const a = data?.allotment;
  const current = a?.workflow.find((s) => s.status === "current");
  const step = current?.key;
  useEffect(() => {
    setRemarks(current?.draftRemarks ?? "");
    setDecision("approve");
    setSignature("");
    setFormError(null);
  }, [step, current?.draftRemarks]);

  if (isLoading) return <><PageHeader title={`${meta.code} Allotment`} /><Skeleton className="h-[640px] w-full rounded-xl" /></>;
  if (error || !data || !a) return <><PageHeader title={`${meta.code} Allotment`} /><Card><ErrorState error={error} onRetry={refetch} /></Card></>;

  const page = step ? REGISTRY_STEP_PAGES[step] : undefined;
  const submitStep = a.workflow.find((s) => s.key === "submit" && s.status === "completed");
  const history = a.workflow.filter((s) => s.key !== "prepared" && s.actedAt);
  const isApprover = step === "review" || step === "accountant" || step === "certification";
  const fundName = appLookups.data?.fundSources.find((f) => f.code === a.fundSource)?.name ?? "";
  const uacsDesc = appLookups.data?.uacsCodes.find((u) => u.code === a.uacsCode)?.description ?? a.objectOfExpenditure;
  const checks = registryChecklist(data);
  const done = a.status === "Released" || a.status === "Partial";
  const stopped = a.workflow.find((s) => s.status === "returned" || s.status === "rejected");
  const busy = acting || deleting;
  const editable = a.status === "Draft" || a.status === "Returned";
  const today = new Date().toISOString();

  const title = page ? `${page.title} – ${meta.code} Allotment` : done ? `Certified – ${meta.code} Allotment` : a.status === "Rejected" ? `Rejected – ${meta.code} Allotment` : a.status === "Returned" ? `Returned for Revision – ${meta.code} Allotment` : `${meta.code} Allotment`;
  const description = page?.description ?? (done ? "This allotment has been reviewed and certified by the Head of Agency." : "Allotment details and approval history.");

  const act = async (action: WorkflowAction) => {
    setFormError(null);
    if (action !== "saveRemarks" && action !== "submit" && !remarks.trim() && (action !== "approve" || step !== "submit")) {
      setFormError({ field: "remarks", message: "Remarks are required." });
      document.getElementById("decision-remarks")?.focus();
      return;
    }
    if (action === "approve" && page?.signature && !signature.trim()) {
      setFormError({ field: "signature", message: "Type your full name as your digital signature." });
      return;
    }
    if (action === "reject" && !window.confirm(`Reject ${a.allotmentNo}? This ends the approval workflow.`)) return;
    try {
      await run({
        id: a.id,
        action,
        remarks: remarks.trim() || undefined,
        signature: signature.trim() || undefined,
        submission: action === "submit" ? { nextApprover: nextApprover || (lookups.data?.approvers[0]?.label ?? ""), targetDate, priority } : undefined,
      }).unwrap();
      const msg: Record<WorkflowAction, string> = {
        saveRemarks: "Saved as draft.",
        submit: "Submitted to the Budget Head for review.",
        approve: step === "certification" ? "Certified. The allotment is now active." : "Approved and forwarded to the next approver.",
        return: "Returned to the Budget Officer for revision.",
        reject: "The allotment was rejected.",
      };
      notify(action === "reject" ? "warning" : "success", a.allotmentNo, msg[action]);
    } catch (err) {
      const field = isApiError(err) && err.fieldErrors ? Object.keys(err.fieldErrors)[0] : undefined;
      setFormError({ field, message: isApiError(err) && field ? err.fieldErrors![field] : getErrorMessage(err) });
    }
  };

  const onPrimary = () => {
    if (step === "submit") return act("submit");
    return act(decision);
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete ${a.allotmentNo}?`)) return;
    try {
      await deleteAllotment(a.id).unwrap();
      notify("success", "Allotment deleted", a.allotmentNo);
      router.push(ROUTES.allotmentClass(meta.slug));
    } catch (err) {
      notify("error", "Unable to delete", getErrorMessage(err));
    }
  };

  const primaryLabel = step === "submit" ? page?.approveLabel : decision === "return" ? "Return for Revision" : decision === "reject" ? "Reject" : page?.approveLabel;
  const outline = "inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50";

  return (
    <>
      <PageHeader title={title} description={description} extraCrumbs={[page?.title ?? a.allotmentNo]} />
      <Card className="mb-5 px-3 py-5 sm:px-6"><ApprovalStepper steps={a.workflow} labels={REGISTRY_STEP_LABELS} /></Card>

      {stopped && (a.status === "Returned" || a.status === "Rejected") && (
        <div className="mb-5">
          <FormAlert>
            <p className="font-medium">{a.status === "Returned" ? "Returned for revision" : "Rejected"} by {stopped.actorName} ({stopped.actorPosition}) on {stopped.actedAt ? formatDateTime(stopped.actedAt) : "—"}</p>
            {stopped.remarks && <p className="mt-0.5">“{stopped.remarks}”</p>}
          </FormAlert>
        </div>
      )}
      {done && <div className="mb-5"><FormAlert tone="success">{a.allotmentNo} was certified on {a.release?.releasedAt ? formatDateTime(a.release.releasedAt) : "—"} and is now active ({formatCurrency(a.amount)}).</FormAlert></div>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardTitle
              icon={FileText}
              action={
                editable ? (
                  <Link href={ROUTES.editClassAllotment(meta.slug, a.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"><Pencil className="size-3.5" /> Edit</Link>
                ) : (
                  <button type="button" onClick={() => document.getElementById("approval-workflow")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"><History className="size-3.5" /> View History</button>
                )
              }
            >
              Allotment Information
            </CardTitle>
            <div className="grid gap-x-8 px-5 py-3 lg:grid-cols-2">
              <dl>
                <Pair label="Allotment No.">{a.allotmentNo}</Pair>
                <Pair label="Fiscal Year">FY {a.fiscalYear}</Pair>
                <Pair label="Tranche">{a.tranche}</Pair>
                <Pair label="Date of Allotment">{formatDate(a.date)}</Pair>
                <Pair label="Reference Document">{a.appropriationRef} · {a.appropriationTitle}</Pair>
                <Pair label="GAA Reference No.">{a.gaaReferenceNo}</Pair>
                <Pair label="Department/Office">{a.department}</Pair>
                <Pair label="Responsibility Center">{a.responsibilityCenter}</Pair>
                <Pair label="Status"><RegistryStatusBadge allotment={a} /></Pair>
              </dl>
              <dl>
                <Pair label="Allotment Class">{meta.code} - {meta.expenseClass}</Pair>
                <Pair label="Funding Source">{a.fundSource} - {fundName}</Pair>
                <Pair label="UACS">
                  {a.uacsCode}
                  <span className="mt-1 block rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600">UACS Description: {uacsDesc}<br />Expense Class: {meta.expenseClass}</span>
                </Pair>
                <Pair label="Particulars / Description">{a.purpose}</Pair>
                <Pair label="Amount (₱)"><span className="font-semibold">{formatCurrency(a.amount)}</span></Pair>
                <Pair label="Remarks">{a.remarks}</Pair>
              </dl>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardTitle icon={ListChecks}>Allotment Line Items</CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Line items</caption>
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    {["#", "UACS Code", "Particulars / Description", "Qty", "Unit", "Unit Cost (₱)", "Amount (₱)", "Remarks"].map((h, i) => (
                      <th key={h} scope="col" className={cn("px-3 py-2.5 font-semibold whitespace-nowrap first:pl-5 last:pr-5", [3, 5, 6].includes(i) ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(a.lineItems ?? []).map((li, i) => (
                    <tr key={li.id}>
                      <td className="px-3 py-2 pl-5">{i + 1}</td>
                      <td className="px-3 py-2 tabular-nums">{li.uacsCode}</td>
                      <td className="px-3 py-2">{li.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{li.quantity.toLocaleString("en-PH")}</td>
                      <td className="px-3 py-2">{li.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(li.unitCost).replace("₱", "")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(li.amount).replace("₱", "")}</td>
                      <td className="px-3 py-2 pr-5 text-gray-600">{li.remarks}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} />
                    <td colSpan={2} className="bg-blue-50 px-3 py-2.5"><span className="flex justify-between font-semibold">Total Amount (₱) <span className="tabular-nums">{formatCurrency(a.amount).replace("₱", "")}</span></span></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardTitle icon={ClipboardCheck}>{step === "review" ? "Review Checklist" : "Checklist"}</CardTitle>
              <ul className="space-y-2.5 p-5 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2.5">
                    {c.ok ? <Check className="mt-0.5 size-[18px] shrink-0 rounded-full bg-green-600 p-0.5 text-white" aria-label="Passed" /> : <XCircle className="mt-px size-5 shrink-0 fill-red-600 text-white" aria-label="Failed" />}
                    <span className={c.ok ? "text-blue-900" : "font-medium text-red-700"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card id="approval-workflow" className="scroll-mt-24">
              <CardTitle icon={History}>Approval Workflow</CardTitle>
              <ol className="space-y-3 p-5 text-sm">
                {a.workflow.filter((s) => s.key !== "prepared").map((s, i) => {
                  const isDone = s.status === "completed";
                  const isCurrent = s.status === "current";
                  const actor = s.actorName ? `${s.actorName} (${s.actorPosition})` : lookups.data?.approvers.find((x) => x.step === s.key)?.label;
                  return (
                    <li key={s.key} className="flex gap-3">
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", isDone ? "bg-green-600" : isCurrent ? "bg-brand-600" : s.status === "pending" ? "bg-gray-400" : "bg-amber-500")}>
                        {isDone ? <Check className="size-4" /> : i + 2}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-blue-900">{REGISTRY_STEP_LABELS[s.key]}</p>
                        {actor && <p className="text-xs text-gray-600">By: {actor}</p>}
                        {s.actedAt && <p className="text-xs text-gray-500">{formatDateTime(s.actedAt)}</p>}
                        {s.remarks && <p className="text-xs text-gray-600 italic">“{s.remarks}”</p>}
                        {s.signature && <p className="font-serif text-sm text-gray-800 italic">Signed: {s.signature}</p>}
                      </div>
                      <span className={cn("h-fit shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium", isDone ? "bg-green-100 text-green-800" : isCurrent ? "bg-red-50 text-brand-700" : s.status === "pending" ? "text-gray-500" : "bg-amber-100 text-amber-800")}>
                        {isDone ? "Completed" : isCurrent ? "Current Step" : s.status === "pending" ? "Pending" : s.status === "returned" ? "Returned" : "Rejected"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </div>
          {config.actionButtons && submitStep?.remarks && isApprover && (
            <Card>
              <CardTitle icon={MessageSquareText}>Remarks from Requestor</CardTitle>
              <div className="space-y-1 p-5 text-sm">
                <p className="text-gray-800">{submitStep.remarks}</p>
                <p className="text-xs text-gray-500">Submitted on {submitStep.actedAt ? formatDateTime(submitStep.actedAt) : "—"}</p>
              </div>
            </Card>
          )}
          {config.actionButtons && history.length > 0 && (
            <Card className="overflow-hidden">
              <CardTitle icon={History}>{done ? "Approval History" : "Previous Approvals"}</CardTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Approval history</caption>
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-700">
                      {["Step", "Name", "Role", "Date & Time", "Status", "Remarks"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-semibold first:pl-5 last:pr-5">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((h, i) => (
                      <tr key={h.key}>
                        <td className="px-3 py-2 pl-5">{i + 1}</td>
                        <td className="px-3 py-2">{REGISTRY_STEP_LABELS[h.key]}</td>
                        <td className="px-3 py-2">{h.actorName}<span className="block text-xs text-gray-500">{h.actorPosition}</span></td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(h.actedAt!)}</td>
                        <td className="px-3 py-2">
                          <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", h.status === "completed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
                            {h.status === "completed" ? (h.key === "submit" ? "Completed" : h.key === "certification" ? "Certified" : "Approved") : h.status === "returned" ? "Returned" : "Rejected"}
                          </span>
                        </td>
                        <td className="px-3 py-2 pr-5 text-gray-600">{h.remarks || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-5">
          {page && (
            <Card>
              <CardTitle icon={FileCheck2}>{page.panelTitle}</CardTitle>
              <div className="space-y-4 p-5 text-sm">
                {step === "submit" ? (
                  <>
                    <Row label="Workflow Status"><span className="rounded-md bg-red-50 px-3 py-1 font-medium text-brand-700">For Submission</span></Row>
                    <Row label="Next Approver" htmlFor="next-approver">
                      <Select id="next-approver" value={nextApprover || lookups.data?.approvers[0]?.label || ""} onChange={(e) => setNextApprover(e.target.value)} options={(lookups.data?.approvers ?? []).filter((x) => x.step === "review").map((x) => ({ value: x.label, label: x.label }))} />
                    </Row>
                    <Row label="Submission Date"><span>{formatDate(today)}</span></Row>
                    <Row label="Target Approval Date" htmlFor="target-date"><Input id="target-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></Row>
                    <Row label="Priority" htmlFor="priority"><Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={(lookups.data?.priorities ?? ["Normal"]).map((p) => ({ value: p, label: p }))} /></Row>
                  </>
                ) : (
                  <>
                    {config.actionButtons && submitStep && (
                      <>
                        <Row label="Requested By"><span className="font-medium">{submitStep.actorName}</span><span className="block text-xs text-gray-500">{submitStep.actorPosition}</span></Row>
                        <Row label="Submitted Date"><span>{submitStep.actedAt ? formatDateTime(submitStep.actedAt) : "—"}</span></Row>
                        {submitStep.submission?.nextApprover && <Row label="For Approval To"><span>{submitStep.submission.nextApprover}</span></Row>}
                        <Row label="Status"><span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{step === "review" ? "For Review and Approval" : step === "accountant" ? "For Accountant Approval" : "For Certification"}</span></Row>
                      </>
                    )}
                    {!config.actionButtons && (
                    <fieldset>
                      <legend className="mb-2 font-medium text-blue-900">Decision <span className="text-brand-600">*</span></legend>
                      <div className="space-y-2">
                        {([["approve", step === "certification" ? "Certify" : "Approve"], ["return", "Return for Revision"], ["reject", "Reject"]] as const).map(([v, l]) => (
                          <label key={v} className="flex items-center gap-2 text-gray-700">
                            <input type="radio" name="decision" className="size-4 accent-brand-600" checked={decision === v} onChange={() => setDecision(v)} /> {l}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    )}
                    <Row label={step === "review" ? "Approval Date" : "Review Date"}><span>{formatDateTime(today)}</span></Row>
                    {step !== "review" && user && <Row label="Reviewed By"><span className="block rounded-lg bg-gray-50 px-3 py-2"><span className="font-medium">{user.firstName} {user.lastName}</span><span className="block text-xs text-gray-500">{ROLE_LABELS[user.role]}</span></span></Row>}
                  </>
                )}
                <div>
                  <label htmlFor="decision-remarks" className="mb-1.5 block font-medium text-blue-900">
                    {step === "submit" ? "Message to Approver" : "Remarks"} {isApprover && <span className="text-brand-600">*</span>}
                  </label>
                  <Textarea id="decision-remarks" rows={4} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} invalid={formError?.field === "remarks"} placeholder={step === "submit" ? "Please review and approve…" : "Remarks"} />
                  <p className="text-right text-xs text-gray-500">{remarks.length}/500</p>
                </div>
                {page.signature && (decision === "approve" || config.actionButtons) && (
                  <div>
                    <label htmlFor="signature" className="mb-1.5 block font-medium text-blue-900">Digital Signature <span className="text-brand-600">*</span></label>
                    <Input id="signature" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type your full name" invalid={formError?.field === "signature"} className="font-serif text-lg italic" />
                    {user && <p className="mt-1 text-xs text-gray-500">{user.firstName} {user.lastName} · {ROLE_LABELS[user.role]}</p>}
                  </div>
                )}
              </div>
            </Card>
          )}

          {config.actionButtons && isApprover && (
            <Card>
              <CardTitle icon={Check}>Approval Actions</CardTitle>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <button type="button" disabled={busy} onClick={() => act("approve")} className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-green-600 px-3 py-3 text-white hover:bg-green-700 disabled:opacity-60 sm:col-span-2">
                  <span className="flex items-center gap-2 font-semibold"><Check className="size-4" /> {step === "certification" ? "Certify" : "Approve"}</span>
                  <span className="text-xs text-green-50">{step === "review" ? "Forward to Accountant" : step === "accountant" ? "Forward to Head of Agency" : "Final approval"}</span>
                </button>
                <button type="button" disabled={busy} onClick={() => act("return")} className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-brand-600 px-3 py-3 text-white hover:bg-brand-700 disabled:opacity-60">
                  <span className="flex items-center gap-2 font-semibold"><RotateCcw className="size-4" /> Return for Revision</span>
                  <span className="text-xs text-red-50">Send back to Budget Officer</span>
                </button>
                <button type="button" disabled={busy} onClick={() => act("reject")} className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-red-300 bg-white px-3 py-3 text-red-700 hover:bg-red-50 disabled:opacity-60">
                  <span className="flex items-center gap-2 font-semibold"><Ban className="size-4" /> Reject</span>
                  <span className="text-xs text-red-600">End the approval workflow</span>
                </button>
                <Link href={ROUTES.allotmentClass(meta.slug)} className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-300 bg-white px-3 py-3 text-gray-800 hover:bg-gray-50 sm:col-span-2">
                  <span className="flex items-center gap-2 font-semibold"><X className="size-4" /> Cancel</span>
                  <span className="text-xs text-gray-500">Close this approval</span>
                </Link>
              </div>
              {acting && <p className="px-5 pb-4 text-xs text-gray-500">Processing…</p>}
            </Card>
          )}
          {config.actionButtons && done && (
            <Card>
              <CardTitle icon={Check}>Actions</CardTitle>
              <div className="space-y-3 p-5">
                <div className="flex flex-col items-center rounded-lg bg-green-100 px-3 py-3 text-green-800">
                  <span className="flex items-center gap-2 font-semibold"><Check className="size-4" /> Certified</span>
                  <span className="text-xs">Final approval completed</span>
                </div>
                <Button variant="outline" className="w-full" onClick={() => window.print()}><Printer className="size-4" /> Print Certification</Button>
              </div>
            </Card>
          )}
          <Card>
            <CardTitle
              icon={Upload}
              action={
                editable || step === "submit" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={attaching}>{!attaching && <Upload className="size-4" />} Upload Files</Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                      className="sr-only"
                      aria-label="Upload supporting document"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          await attach({ id: a.id, file }).unwrap();
                          notify("success", "Document added", file.name);
                        } catch (err) {
                          notify("error", "Unable to upload", getErrorMessage(err));
                        }
                      }}
                    />
                  </>
                ) : undefined
              }
            >
              Supporting Documents ({a.documents.length})
            </CardTitle>
            {a.documents.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">No documents attached.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {a.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <FileText className="size-4 shrink-0 text-red-600" aria-hidden />
                    <span className="min-w-0 flex-1">
                      {d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="block truncate text-blue-700 hover:underline">{d.name}</a> : <span className="block truncate text-gray-800" title="Sample record: no stored file">{d.name}</span>}
                      <span className="text-xs text-gray-500">{formatFileSize(d.size)} · {d.uploadedBy ?? "—"} · {formatDateTime(d.uploadedAt)}</span>
                    </span>
                    {(editable || step === "submit") && (
                      <button type="button" onClick={() => removeDoc({ id: a.id, docId: d.id })} className="rounded p-1.5 text-brand-600 hover:bg-red-50 disabled:opacity-40" aria-label={`Remove ${d.name}`} disabled={!editable}>
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t border-gray-200 bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {formError && <div className="mb-3"><FormAlert>{formError.message}</FormAlert></div>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            {step === "submit" ? (
              <Link href={ROUTES.editClassAllotment(meta.slug, a.id)} className={outline}><ChevronLeft className="size-4" /> Back to Edit</Link>
            ) : (
              <Link href={ROUTES.allotmentClass(meta.slug)} className={outline}><ChevronLeft className="size-4" /> Back to {meta.code} Allotments</Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {user && isApprover && <span className="max-w-xs text-xs text-gray-500">Acting as {user.firstName} {user.lastName} ({ROLE_LABELS[user.role]}). Demo mode does not restrict approvers by role.</span>}
            {page && (
              <Button variant="outline" size="lg" onClick={() => act("saveRemarks")} loading={acting && originalArgs?.action === "saveRemarks"} disabled={busy}><Save className="size-4" /> Save as Draft</Button>
            )}
            {page && !(config.actionButtons && isApprover) && (
              <Button size="lg" variant={decision === "reject" && step !== "submit" ? "danger" : "primary"} onClick={onPrimary} loading={acting && originalArgs?.action !== "saveRemarks"} disabled={busy}>
                {step === "submit" ? <Send className="size-4" /> : decision === "return" ? <RotateCcw className="size-4" /> : <Check className="size-4" />} {primaryLabel}
              </Button>
            )}
            {step === "prepared" && editable && (
              <>
                <Button variant="danger" size="lg" onClick={onDelete} loading={deleting} disabled={busy}><Trash2 className="size-4" /> Delete</Button>
                <Link href={ROUTES.editClassAllotment(meta.slug, a.id)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"><Pencil className="size-4" /> Edit and Resubmit</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center sm:gap-3">
      {htmlFor ? <label htmlFor={htmlFor} className="text-blue-900">{label}</label> : <span className="text-blue-900">{label}</span>}
      <div>{children}</div>
    </div>
  );
}

