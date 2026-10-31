"use client";

import Link from "next/link";
import { ArrowLeft, FileText, ListChecks, NotebookPen, Paperclip, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import type { AllotmentClassMeta } from "@/lib/constants/allotment-classes";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useGetAllotmentQuery, useGetRegistryLookupsQuery } from "@/features/allotments/services/allotmentsApi";
import { CATEGORY_TONES } from "./RaofeAllotmentWizard";
import { DocsTable, Head, Pair } from "./RegistryAllotmentWizard";
import { RegistryStatusBadge } from "./RegistryStatusBadge";

/** View-only RAOFE allotment details (no approval actions on this page). */
export function RaofeAllotmentView({ meta, id }: { meta: AllotmentClassMeta; id: string }) {
  const { data, isLoading, error, refetch } = useGetAllotmentQuery(id);
  const lookups = useGetRegistryLookupsQuery(meta.code);
  if (isLoading) return <><PageHeader title={`${meta.code} Allotment`} /><Skeleton className="h-[560px] w-full rounded-xl" /></>;
  if (error || !data) return <><PageHeader title={`${meta.code} Allotment`} /><Card><ErrorState error={error} onRetry={refetch} /></Card></>;
  const a = data.allotment;
  const categories = lookups.data?.lineCategories ?? [];
  const tone = (c: string) => (categories.includes(c) ? CATEGORY_TONES[categories.indexOf(c) % CATEGORY_TONES.length] : "bg-gray-100 text-gray-700");
  const editable = a.workflowType === "registry" && (a.status === "Draft" || a.status === "Returned");
  const lines = a.lineItems ?? [];
  const linkBtn = "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium";

  return (
    <>
      <PageHeader
        title={a.allotmentNo}
        description={a.purpose || a.objectOfExpenditure}
        extraCrumbs={[a.allotmentNo]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={ROUTES.allotmentClass(meta.slug)} className={cn(linkBtn, "border-blue-600 bg-white text-blue-700 hover:bg-blue-50")}><ArrowLeft className="size-4" /> Back to List</Link>
            {editable && <Link href={ROUTES.editClassAllotment(meta.slug, a.id)} className={cn(linkBtn, "border-blue-600 bg-blue-600 text-white hover:bg-blue-700")}><Pencil className="size-4" /> Edit</Link>}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card>
          <Head icon={FileText} title="Allotment Information" action={<RegistryStatusBadge allotment={a} />} />
          <dl className="px-5 py-3">
            <Pair label="Allotment No.">{a.allotmentNo}</Pair>
            <Pair label="Fiscal Year">FY {a.fiscalYear}</Pair>
            <Pair label="Tranche">{a.tranche}</Pair>
            <Pair label="Allotment Date">{formatDate(a.date)}</Pair>
            <Pair label="GAA Reference No.">{a.gaaReferenceNo}</Pair>
            <Pair label="Department/Office">{a.department}</Pair>
            <Pair label="Responsibility Center">{a.responsibilityCenter}</Pair>
            <Pair label="Allotment Class">{meta.code}</Pair>
            <Pair label="Reference Appropriation">{`${a.appropriationRef} · ${a.appropriationTitle}`}</Pair>
            <Pair label="UACS Code">{`${a.uacsCode} - ${a.objectOfExpenditure}`}</Pair>
            <Pair label="Allotment Amount"><span className="font-bold text-blue-700">{formatCurrency(a.amount)}</span></Pair>
            <Pair label="Obligations">{formatCurrency(a.obligated)}</Pair>
            <Pair label="Balance">{formatCurrency(a.amount - a.obligated)}</Pair>
          </dl>
        </Card>
        <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden">
            <Head icon={ListChecks} title="Line Items" tone="text-green-600" />
            {lines.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">No line items were encoded for this allotment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Line items</caption>
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      {["#", "UACS Code", "Particulars / Description", "Qty", "Unit", "Unit Cost (₱)", "Amount (₱)", "Category", "Remarks"].map((h, i) => <th key={h} scope="col" className={cn("px-3 py-2 first:pl-5 last:pr-5", [3, 5, 6].includes(i) ? "text-right" : "text-left")}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((li, i) => (
                      <tr key={li.id}>
                        <td className="px-3 py-2 pl-5">{i + 1}</td>
                        <td className="px-3 py-2 text-blue-700 tabular-nums">{li.uacsCode}</td>
                        <td className="px-3 py-2">{li.description}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{li.quantity}</td>
                        <td className="px-3 py-2">{li.unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(li.unitCost).replace("₱", "")}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(li.amount).replace("₱", "")}</td>
                        <td className="px-3 py-2">{li.category ? <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone(li.category))}>{li.category}</span> : "—"}</td>
                        <td className="px-3 py-2 pr-5">{li.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-blue-50"><td colSpan={6} className="px-3 py-2.5 text-right font-semibold">Total</td><td className="px-3 py-2.5 text-right font-bold text-blue-700 tabular-nums">{formatCurrency(lines.reduce((s, li) => s + li.amount, 0))}</td><td colSpan={2} /></tr></tfoot>
                </table>
              </div>
            )}
          </Card>
          <Card className="overflow-hidden">
            <Head icon={Paperclip} title={`Supporting Documents (${a.documents.length})`} tone="text-purple-600" />
            <DocsTable documents={a.documents} />
          </Card>
          <Card>
            <Head icon={NotebookPen} title="Remarks / Notes" tone="text-amber-500" />
            <p className="p-5 text-sm text-gray-800">{a.remarks || "No remarks."}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
