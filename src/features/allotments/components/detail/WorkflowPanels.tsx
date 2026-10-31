"use client";

import { CheckCircle2, Circle, ClipboardCheck, History, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import type { WorkflowStep } from "../../types";
import { STEP_LABELS, type CheckItem } from "../../workflow";
import { CardTitle } from "./InfoCards";

export function ChecklistCard({
  title,
  items,
  confirmed,
  onToggle,
  readOnly,
}: {
  title: string;
  items: CheckItem[];
  confirmed: Set<string>;
  onToggle: (label: string) => void;
  readOnly?: boolean;
}) {
  return (
    <Card>
      <CardTitle icon={ClipboardCheck}>{title}</CardTitle>
      <ul className="space-y-2.5 p-5 text-sm">
        {items.map((item) =>
          item.kind === "auto" ? (
            <li key={item.label} className="flex items-start gap-2.5">
              {item.ok ? (
                <CheckCircle2 className="mt-px size-5 shrink-0 fill-green-600 text-white" aria-label="Passed" />
              ) : (
                <XCircle className="mt-px size-5 shrink-0 fill-red-600 text-white" aria-label="Failed" />
              )}
              <span className={item.ok ? "text-gray-700" : "font-medium text-red-700"}>{item.label}</span>
            </li>
          ) : (
            <li key={item.label}>
              <label className="flex items-start gap-2.5 text-gray-700">
                <input
                  type="checkbox"
                  className="mt-0.5 size-[18px] shrink-0 accent-green-600"
                  checked={readOnly || confirmed.has(item.label)}
                  disabled={readOnly}
                  onChange={() => onToggle(item.label)}
                />
                <span>
                  {item.label}
                  {!readOnly && <span className="block text-xs text-gray-400">Confirm to approve</span>}
                </span>
              </label>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}

const STATUS_TEXT: Record<WorkflowStep["status"], string> = {
  completed: "",
  current: "Pending for action",
  pending: "Pending",
  returned: "Returned for revision",
  rejected: "Rejected",
};

export function AuditTrailCard({ steps }: { steps: WorkflowStep[] }) {
  return (
    <Card>
      <CardTitle icon={History}>Audit Trail / History</CardTitle>
      <ol className="p-5">
        {steps.map((s, i) => {
          const done = s.status === "completed";
          return (
            <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && <span aria-hidden className={cn("absolute top-5 left-[9px] h-full w-0.5", done ? "bg-green-600" : "bg-gray-200")} />}
              <span className="relative z-10 mt-0.5">
                {done ? (
                  <CheckCircle2 className="size-5 fill-green-600 text-white" aria-hidden />
                ) : s.status === "current" ? (
                  <span className="block size-5 rounded-full border-4 border-red-100 bg-brand-600" aria-hidden />
                ) : s.status === "returned" || s.status === "rejected" ? (
                  <XCircle className="size-5 fill-amber-500 text-white" aria-hidden />
                ) : (
                  <Circle className="size-5 text-gray-400" aria-hidden />
                )}
              </span>
              <div className={cn("flex min-w-0 flex-1 justify-between gap-3 rounded-lg px-2 py-1", s.status === "current" && "bg-red-50")}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{done ? STEP_LABELS[s.key].done : STEP_LABELS[s.key].todo}</p>
                  <p className={cn("text-xs", s.status === "current" ? "text-brand-600" : "text-gray-500")}>
                    {s.actorName ? `By ${s.actorName}` : STATUS_TEXT[s.status]}
                    {s.actorName && s.status !== "completed" ? ` · ${STATUS_TEXT[s.status]}` : ""}
                  </p>
                  {s.remarks && <p className="mt-0.5 text-xs text-gray-600 italic">“{s.remarks}”</p>}
                </div>
                {s.actedAt && <span className="shrink-0 text-xs whitespace-nowrap text-gray-500">{formatDateTime(s.actedAt)}</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
