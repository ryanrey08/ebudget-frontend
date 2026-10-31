"use client";

import { FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AllotmentClassBadge } from "@/components/shared/AllotmentClassBadge";
import { formatCurrency, formatDate, formatFileSize } from "@/lib/utils/format";
import type { Appropriation } from "../../types";
import { AppropriationStatusBadge } from "./AppropriationStatusBadge";

export function AppropriationDetailModal({
  appropriation: a,
  fundSourceName,
  onClose,
}: {
  appropriation: Appropriation | null;
  fundSourceName: (code: string) => string;
  onClose: () => void;
}) {
  if (!a) return null;
  const rows: [string, React.ReactNode][] = [
    ["Reference No.", a.referenceNo],
    ["Status", <AppropriationStatusBadge key="s" status={a.status} />],
    ["Fiscal Year", a.fiscalYear],
    ["Type", a.type === "GAA" ? "General Appropriations Act (GAA)" : "Supplemental Appropriation"],
    ["Organization/Office", `${a.orgCode} – ${a.office}`],
    ["Program/Activity", a.program || "—"],
    ["UACS Code", a.uacsCode || "—"],
    ["Description", a.objectOfExpenditure || "—"],
    ["Fund Source", a.fundSource ? `${a.fundSource} - ${fundSourceName(a.fundSource)}` : "—"],
    ["Allotment Class", <AllotmentClassBadge key="c" code={a.allotmentClass} />],
    ["Appropriation Amount", formatCurrency(a.amount)],
    ["Allotted / Released", `${formatCurrency(a.allotted)} / ${formatCurrency(a.released)}`],
    ["Appropriation Level", a.level || "—"],
    ["GAA Reference", a.gaaReference || "—"],
    ["GAA Part/Agency", a.gaaPart || "—"],
    ["Effectivity / Expiry", `${a.effectivityDate ? formatDate(a.effectivityDate) : "—"} – ${a.expiryDate ? formatDate(a.expiryDate) : "—"}`],
    ["Remarks", a.remarks || "—"],
  ];
  return (
    <Modal open onClose={onClose} size="lg" title={a.title} description={a.referenceNo} footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500">Supporting Documents</p>
        {a.documents.length ? (
          <ul className="mt-2 space-y-1.5">
            {a.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm text-gray-800">
                <FileText className="size-4 text-gray-400" aria-hidden /> {d.name}
                <span className="text-xs text-gray-500">{formatFileSize(d.size)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-500">No documents attached.</p>
        )}
      </div>
    </Modal>
  );
}
