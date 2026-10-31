"use client";

import { useRef } from "react";
import { BarChart3, Download, Eye, FileImage, FileSpreadsheet, FileText, Lock, Paperclip, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AllotmentClassBadge } from "@/components/shared/AllotmentClassBadge";
import { getAllotmentClass } from "@/lib/constants/allotment-classes";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/utils/format";
import type { Allotment, AllotmentDocument, AppropriationBalance } from "../../types";

export function CardTitle({ icon: Icon, children, action }: { icon: typeof FileText; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Icon className="size-5 text-brand-600" aria-hidden /> {children}
      </h2>
      {action}
    </div>
  );
}

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2 border-b border-gray-50 py-2 text-sm last:border-0">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-gray-900">{children}</dd>
    </div>
  );
}

export function AllotmentInfoCard({ allotment: a, fundName }: { allotment: Allotment; fundName: string }) {
  const cls = getAllotmentClass(a.allotmentClass);
  return (
    <Card>
      <CardTitle
        icon={FileText}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600">
            <Lock className="size-3.5" aria-hidden /> Read only
          </span>
        }
      >
        Allotment Information
      </CardTitle>
      <div className="grid gap-x-8 px-5 py-3 lg:grid-cols-2">
        <dl>
          <Pair label="Allotment No.">{a.allotmentNo}</Pair>
          <Pair label="Appropriation No.">{a.appropriationRef}</Pair>
          <Pair label="Fiscal Year">{a.fiscalYear}</Pair>
          <Pair label="Appropriation Title">{a.appropriationTitle}</Pair>
          <Pair label="Organization/Office">{a.orgCode} - {a.office}</Pair>
          <Pair label="Program/Activity">{a.program}</Pair>
          <Pair label="UACS Code">{a.uacsCode}</Pair>
          <Pair label="Description">{a.objectOfExpenditure}</Pair>
        </dl>
        <dl>
          <Pair label="Allotment Class">
            <AllotmentClassBadge code={a.allotmentClass} />
            <span className="mt-1 block text-xs text-gray-500">{cls?.name}</span>
          </Pair>
          <Pair label="Fund Source">{a.fundSource} - {fundName}</Pair>
          <Pair label="Allotment Amount"><span className="font-semibold">{formatCurrency(a.amount)}</span></Pair>
          <Pair label="Tranche">{a.tranche}</Pair>
          <Pair label="Release Amount"><span className="font-semibold">{formatCurrency(a.releaseAmount)}</span></Pair>
          <Pair label="Release Date">{a.releaseDate ? formatDate(a.releaseDate) : "—"}</Pair>
          <Pair label="Purpose/Particulars">{a.purpose || "—"}</Pair>
        </dl>
      </div>
    </Card>
  );
}

function fileMeta(d: AllotmentDocument) {
  const ext = d.name.slice(d.name.lastIndexOf(".") + 1).toUpperCase();
  if (ext === "PDF") return { ext, Icon: FileText, cls: "bg-red-600" };
  if (ext === "XLSX" || ext === "XLS") return { ext, Icon: FileSpreadsheet, cls: "bg-green-700" };
  return { ext, Icon: FileImage, cls: "bg-blue-600" };
}

export function DocumentsCard({
  documents,
  onAdd,
  adding,
}: {
  documents: AllotmentDocument[];
  onAdd?: (file: File) => void;
  adding?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={Paperclip}
        action={
          onAdd && (
            <>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} loading={adding}>
                {!adding && <Plus className="size-4" />} Add Documents
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                className="sr-only"
                aria-label="Add supporting document"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onAdd(file);
                  e.target.value = "";
                }}
              />
            </>
          )
        }
      >
        Supporting Documents ({documents.length})
      </CardTitle>
      {documents.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">No supporting documents attached.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Supporting documents</caption>
            <thead>
              <tr className="bg-gray-50 text-left text-gray-700">
                {["#", "File Name", "File Type", "File Size", "Uploaded By", "Date Uploaded", "Actions"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-semibold whitespace-nowrap first:pl-5 last:pr-5 last:text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((d, i) => {
                const { ext, Icon, cls } = fileMeta(d);
                return (
                  <tr key={d.id}>
                    <td className="px-3 py-2.5 pl-5">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className={cn("flex size-7 items-center justify-center rounded text-white", cls)}><Icon className="size-4" aria-hidden /></span>
                        <span className="text-blue-700">{d.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{ext}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatFileSize(d.size)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{d.uploadedBy ?? "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(d.uploadedAt)}</td>
                    <td className="px-3 py-2.5 pr-5">
                      <span className="flex justify-center gap-1">
                        {d.url ? (
                          <>
                            <a href={d.url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-gray-700 hover:bg-gray-100" aria-label={`View ${d.name}`}><Eye className="size-4" /></a>
                            <a href={d.url} download={d.name} className="rounded p-1.5 text-gray-700 hover:bg-gray-100" aria-label={`Download ${d.name}`}><Download className="size-4" /></a>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400" title="Sample record: no stored file in demo mode">Sample file</span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function BalanceCard({ balance }: { balance: AppropriationBalance | null }) {
  return (
    <Card>
      <CardTitle icon={BarChart3}>Appropriation Balance</CardTitle>
      {balance ? (
        <dl className="space-y-1 p-4 text-sm">
          <div className="flex justify-between px-1 py-1.5"><dt className="text-gray-600">Total Appropriation Amount</dt><dd className="font-semibold tabular-nums">{formatCurrency(balance.amount)}</dd></div>
          <div className="flex justify-between px-1 py-1.5"><dt className="text-gray-600">Total Allotments</dt><dd className="font-semibold tabular-nums">{formatCurrency(balance.totalAllotted)}</dd></div>
          <div className="flex justify-between rounded-lg bg-blue-50 px-3 py-2"><dt className="font-medium text-gray-800">Remaining Balance</dt><dd className="font-bold tabular-nums">{formatCurrency(balance.remaining)}</dd></div>
        </dl>
      ) : (
        <p className="p-5 text-sm text-red-600">The linked appropriation was not found.</p>
      )}
    </Card>
  );
}
