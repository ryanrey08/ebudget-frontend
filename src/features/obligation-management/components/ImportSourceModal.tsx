"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import type { ProcurementSource } from "../types";

/** Pick a sample PR/PO or APP entry to copy its line items and references into the form. */
export function ImportSourceModal({
  type,
  sources,
  onClose,
  onImport,
}: {
  type: ProcurementSource["type"] | null;
  sources: ProcurementSource[];
  onClose: () => void;
  onImport: (source: ProcurementSource) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  if (!type) return null;
  const list = sources.filter((s) => s.type === type);
  const chosen = list.find((s) => s.referenceNo === picked);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={type === "APP" ? "Import from APP" : "Import from PR/PO"}
      description="Line items and reference numbers replace the current ones. Sample records in demo mode."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!chosen} onClick={() => chosen && onImport(chosen)}>Import items</Button>
        </>
      }
    >
      <ul className="space-y-2" role="radiogroup" aria-label="Source documents">
        {list.map((s) => {
          const total = s.items.reduce((t, i) => t + i.quantity * i.unitCost, 0);
          return (
            <li key={s.referenceNo}>
              <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3", picked === s.referenceNo ? "border-brand-500 bg-brand-50/40" : "border-gray-200 hover:bg-gray-50")}>
                <input type="radio" name="source" className="mt-1 accent-brand-600" checked={picked === s.referenceNo} onChange={() => setPicked(s.referenceNo)} />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold text-gray-900">{s.referenceNo} · {s.title}</span>
                    <span className="tabular-nums text-gray-700">{formatCurrency(total)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {[s.prNo && `PR ${s.prNo}`, s.poNo && `PO ${s.poNo}`, s.appNo && `APP ${s.appNo}`, s.payee].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 block text-xs text-gray-600">{s.items.map((i) => i.description).join(", ")}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
