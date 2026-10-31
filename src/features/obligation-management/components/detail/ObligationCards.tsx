"use client";

import { BarChart3, CheckCircle2, Circle, FileText, History, ListChecks, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getAllotmentClass } from "@/lib/constants/allotment-classes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { CardTitle } from "@/features/allotments/components/detail/InfoCards";
import type { AllotmentBalanceInfo, Obligation, ObligationStep } from "../../types";
import { OBLIGATION_STEP_LABELS } from "../../workflow";
import { ObligationStatusBadge } from "../ObligationStatusBadge";

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-2 border-b border-gray-50 py-1.5 text-sm last:border-0">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-gray-900">{children || "—"}</dd>
    </div>
  );
}

export function ObligationInfoCard({ obligation: o, fundName, action }: { obligation: Obligation; fundName: string; action?: React.ReactNode }) {
  const cls = getAllotmentClass(o.allotmentClass);
  return (
    <Card>
      <CardTitle icon={FileText} action={action}>Obligation Information</CardTitle>
      <div className="grid gap-x-8 px-5 py-3 lg:grid-cols-2">
        <dl>
          <Pair label="Obligation No.">{o.referenceNo}</Pair>
          <Pair label="Obligation Date">{formatDate(o.date)}</Pair>
          <Pair label="Allotment No.">{o.allotmentRef}</Pair>
          <Pair label="Allotment Class">{cls ? `${cls.code} - ${cls.expenseClass}` : o.allotmentClass}</Pair>
          <Pair label="Tranche">{o.tranche}</Pair>
          <Pair label="Fund Source">{o.fundSource ? `${o.fundSource} - ${fundName}` : ""}</Pair>
          <Pair label="Responsibility Center">{o.responsibilityCenter}</Pair>
          <Pair label="Particulars">{o.particulars}</Pair>
          <Pair label="Status"><ObligationStatusBadge status={o.status} /></Pair>
        </dl>
        <dl>
          <Pair label="Mode of Procurement">{o.modeOfProcurement}</Pair>
          <Pair label="APP No.">{o.appNo}</Pair>
          <Pair label="PR No.">{o.prNo}</Pair>
          <Pair label="PO No.">{o.poNo}</Pair>
          <Pair label="Payee/Supplier">{o.payee}</Pair>
          <Pair label="TIN">{o.tin}</Pair>
          <Pair label="Address">{o.address}</Pair>
          <Pair label="Project/Activity">{o.projectActivity}</Pair>
          <div className="mt-2 flex justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-gray-900">
            <span>Total Amount</span>
            <span className="tabular-nums">{formatCurrency(o.amount)}</span>
          </div>
        </dl>
      </div>
      {(o.remarks || o.applicableDocuments.length > 0) && (
        <div className="border-t border-gray-100 px-5 py-3 text-sm text-gray-700">
          {o.remarks && <p><span className="text-gray-500">Remarks:</span> {o.remarks}</p>}
          {o.applicableDocuments.length > 0 && (
            <p className="mt-1"><span className="text-gray-500">Applicable documents:</span> {o.applicableDocuments.join(", ")}</p>
          )}
        </div>
      )}
    </Card>
  );
}

export function LineItemsCard({ obligation: o }: { obligation: Obligation }) {
  return (
    <Card className="overflow-hidden">
      <CardTitle icon={ListChecks}>Obligation Line Items</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Line items</caption>
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              {["#", "UACS Code", "Particulars / Description", "Qty", "Unit", "Unit Cost (₱)", "Amount (₱)"].map((h, i) => (
                <th key={h} scope="col" className={cn("px-3 py-2.5 font-semibold whitespace-nowrap first:pl-5 last:pr-5", i >= 3 && i !== 4 ? "text-right" : "text-left")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {o.lineItems.map((li, i) => (
              <tr key={li.id}>
                <td className="px-3 py-2 pl-5">{i + 1}</td>
                <td className="px-3 py-2 tabular-nums">{li.uacsCode}</td>
                <td className="px-3 py-2">{li.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{li.quantity.toLocaleString("en-PH")}</td>
                <td className="px-3 py-2">{li.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(li.unitCost).replace("₱", "")}</td>
                <td className="px-3 py-2 pr-5 text-right tabular-nums">{formatCurrency(li.amount).replace("₱", "")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} />
              <td colSpan={2} className="bg-blue-50 px-3 py-2.5 pr-5">
                <span className="flex justify-between font-semibold">Total Amount (₱) <span className="tabular-nums">{formatCurrency(o.amount).replace("₱", "")}</span></span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

export function AllotmentBalanceCard({ balance, current }: { balance: AllotmentBalanceInfo | null; current: number }) {
  return (
    <Card>
      <CardTitle icon={BarChart3}>Allotment Balance</CardTitle>
      {balance ? (
        <dl className="space-y-1 p-4 text-sm">
          <div className="flex justify-between px-1 py-1.5"><dt className="text-gray-600">Allotment No.</dt><dd className="font-semibold">{balance.allotmentNo}</dd></div>
          <div className="flex justify-between px-1 py-1.5"><dt className="text-gray-600">Allotment Amount</dt><dd className="font-semibold tabular-nums">{formatCurrency(balance.amount)}</dd></div>
          <div className="flex justify-between px-1 py-1.5"><dt className="text-gray-600">Total Obligations</dt><dd className="font-semibold tabular-nums">{formatCurrency(balance.otherObligations)}</dd></div>
          <div className="flex justify-between rounded-lg bg-blue-50 px-3 py-2"><dt className="font-medium text-blue-900">Current Obligation <span className="font-normal">(This transaction)</span></dt><dd className="font-bold tabular-nums text-blue-900">{formatCurrency(current)}</dd></div>
          <div className="flex justify-between px-1 py-1.5">
            <dt className="text-gray-600">Remaining Balance</dt>
            <dd className={cn("font-semibold tabular-nums", balance.remaining - current < 0 && "text-red-600")}>{formatCurrency(balance.remaining - current)}</dd>
          </div>
        </dl>
      ) : (
        <p className="p-5 text-sm text-red-600">The linked allotment was not found.</p>
      )}
    </Card>
  );
}

export function WorkflowTimelineCard({ steps, id }: { steps: ObligationStep[]; id?: string }) {
  // "Encode Details" is shown in the header progress only; the timeline starts at submission.
  const shown = steps.filter((s) => s.key !== "encode");
  return (
    <Card id={id} className="scroll-mt-24">
      <CardTitle icon={History}>Approval Workflow</CardTitle>
      <ol className="p-5">
        {shown.map((s, i) => {
          const done = s.status === "completed";
          const stopped = s.status === "returned" || s.status === "rejected";
          return (
            <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
              {i < shown.length - 1 && <span aria-hidden className={cn("absolute top-6 left-[11px] h-full w-0.5", done ? "bg-green-600" : "bg-gray-200")} />}
              <span className="relative z-10 mt-0.5">
                {done ? (
                  <CheckCircle2 className="size-6 fill-green-600 text-white" aria-hidden />
                ) : s.status === "current" ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
                ) : stopped ? (
                  <XCircle className="size-6 fill-amber-500 text-white" aria-hidden />
                ) : (
                  <Circle className="size-6 fill-gray-400 text-white" aria-hidden />
                )}
              </span>
              <div className={cn("flex min-w-0 flex-1 justify-between gap-2 rounded-lg px-2 py-1", s.status === "current" && "bg-red-50")}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{OBLIGATION_STEP_LABELS[s.key]}</p>
                  {s.actorName && <p className="text-xs text-gray-600">By: {s.actorName} ({s.actorPosition})</p>}
                  {s.actedAt && <p className="text-xs text-gray-500">{formatDateTime(s.actedAt)}</p>}
                  {!s.actorName && <p className="text-xs text-gray-500">{s.status === "current" ? "Awaiting action" : "Pending"}</p>}
                  {s.remarks && <p className="mt-0.5 text-xs text-gray-600 italic">“{s.remarks}”</p>}
                  {s.signature && <p className="mt-0.5 font-serif text-sm text-gray-800 italic">Signed: {s.signature}</p>}
                </div>
                <span
                  className={cn(
                    "h-fit shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium",
                    done ? "bg-green-100 text-green-800" : s.status === "current" ? "bg-blue-100 text-blue-800" : stopped ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600",
                  )}
                >
                  {done ? "Completed" : s.status === "current" ? "Current Step" : s.status === "returned" ? "Returned" : s.status === "rejected" ? "Rejected" : "Pending"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
