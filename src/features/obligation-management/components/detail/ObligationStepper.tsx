import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ObligationStep } from "../../types";
import { OBLIGATION_STEP_LABELS } from "../../workflow";

const STATE_TEXT: Record<ObligationStep["status"], string> = {
  completed: "Completed",
  current: "Current Step",
  pending: "Pending",
  returned: "Returned",
  rejected: "Rejected",
};

export function ObligationStepper({ steps }: { steps: ObligationStep[] }) {
  return (
    <ol className="grid grid-cols-3 gap-y-5 sm:grid-cols-6" aria-label="Obligation approval progress">
      {steps.map((s, i) => {
        const done = s.status === "completed";
        const current = s.status === "current";
        const stopped = s.status === "returned" || s.status === "rejected";
        const next = steps[i + 1];
        return (
          <li key={s.key} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center px-1 text-center">
            {next && (
              <span aria-hidden className={cn("absolute top-4 left-1/2 hidden h-0.5 w-full sm:block", done && next.status !== "pending" ? "bg-blue-600" : done ? "bg-brand-500" : "bg-gray-200")} />
            )}
            <span
              className={cn(
                "relative z-10 flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold",
                done && "border-blue-600 bg-blue-600 text-white",
                current && "border-brand-600 bg-brand-600 text-white",
                stopped && "border-amber-500 bg-amber-500 text-white",
                !done && !current && !stopped && "border-gray-400 bg-white text-gray-600",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : s.status === "returned" ? <RotateCcw className="size-4" /> : s.status === "rejected" ? <X className="size-4" /> : i + 1}
            </span>
            <span className={cn("mt-2 text-xs leading-tight font-medium sm:text-sm", done ? "text-blue-900" : current ? "text-gray-900" : "text-gray-500")}>
              {OBLIGATION_STEP_LABELS[s.key]}
            </span>
            <span className={cn("mt-0.5 text-[11px] sm:text-xs", current ? "font-medium text-brand-600" : stopped ? "text-amber-700" : "text-gray-500")}>{STATE_TEXT[s.status]}</span>
          </li>
        );
      })}
    </ol>
  );
}
