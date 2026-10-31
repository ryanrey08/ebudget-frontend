import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import type { WorkflowStep } from "../types";
import { STEP_LABELS } from "../workflow";

/** Five-step approval tracker: Prepared → Review → Accountant → Head of Agency → Released. */
export function ApprovalStepper({
  steps,
  className,
  labels,
}: {
  steps: WorkflowStep[];
  className?: string;
  /** Override step names (e.g. the allotment-class registry wording). */
  labels?: Partial<Record<WorkflowStep["key"], string>>;
}) {
  return (
    <ol className={cn("grid grid-cols-5 gap-1", className)} aria-label="Approval workflow">
      {steps.map((step, i) => {
        const done = step.status === "completed";
        const current = step.status === "current";
        const stopped = step.status === "returned" || step.status === "rejected";
        const next = steps[i + 1];
        return (
          <li key={step.key} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center text-center">
            {next && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 left-1/2 h-0.5 w-full",
                  done && next.status === "completed" ? "bg-green-600" : done ? "bg-brand-500" : "bg-gray-200",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                done && "border-green-600 bg-green-600 text-white",
                current && "border-brand-600 bg-brand-600 text-white",
                stopped && "border-amber-500 bg-amber-500 text-white",
                !done && !current && !stopped && "border-gray-400 bg-white text-gray-600",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : step.status === "returned" ? <RotateCcw className="size-4" /> : step.status === "rejected" ? <X className="size-4" /> : i + 1}
            </span>
            <span className={cn("mt-2 text-xs leading-tight sm:text-sm", current ? "font-semibold text-gray-900" : done ? "text-gray-800" : "text-gray-500")}>
              {labels?.[step.key] ?? (done ? STEP_LABELS[step.key].done : STEP_LABELS[step.key].todo)}
            </span>
            {step.actedAt && <span className="mt-0.5 hidden text-[11px] text-gray-500 sm:block">{formatDateTime(step.actedAt)}</span>}
            {current && <span className="mt-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Current Step</span>}
            {stopped && (
              <span className="mt-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                {step.status === "returned" ? "Returned" : "Rejected"}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
