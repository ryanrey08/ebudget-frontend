import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { GAA_STEPS, type GaaStep } from "../../state/gaaWizardSlice";

const STEP_META: Record<GaaStep, { title: string; hint: string }> = {
  upload: { title: "Upload File", hint: "Select GAA file" },
  validate: { title: "Validate Data", hint: "Check for errors" },
  map: { title: "Map & Configure", hint: "Confirm mapping" },
  import: { title: "Import to System", hint: "Create Appropriations" },
};

export function GaaStepper({
  current,
  fileName,
  completed,
}: {
  current: GaaStep;
  fileName?: string;
  /** True once the import has finished, so every step shows as done. */
  completed?: boolean;
}) {
  const currentIndex = GAA_STEPS.indexOf(current);

  return (
    <nav aria-label="GAA import progress" className="mb-5 rounded-xl border border-gray-200/70 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GAA_STEPS.map((step, i) => {
          const done = completed || i < currentIndex;
          const active = !completed && i === currentIndex;
          const hint = done ? (i === 0 && fileName ? fileName : "Completed") : STEP_META[step].hint;
          return (
            <li key={step} aria-current={active ? "step" : undefined} className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold",
                  done || active ? "bg-brand-600 text-white shadow-[0_4px_12px_rgba(215,31,38,0.3)]" : "bg-gray-400 text-white",
                )}
              >
                {done ? <Check className="size-5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cn("block font-semibold", done || active ? "text-gray-900" : "text-gray-700")}>
                  {STEP_META[step].title}
                </span>
                <span className="block truncate text-xs text-gray-500" title={hint}>
                  {hint}
                </span>
              </span>
              {i < GAA_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn("hidden h-px flex-1 xl:block", done ? "bg-brand-500" : "bg-gray-200")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export const GAA_STEP_TITLES: Record<GaaStep, { title: string; description: string }> = {
  upload: {
    title: "GAA Upload",
    description: "Upload, validate and import General Appropriations Act (GAA) data to create Appropriations.",
  },
  validate: {
    title: "Validate Data",
    description: "Check the uploaded GAA data for errors, inconsistencies and duplicates before importing.",
  },
  map: {
    title: "Map & Configure",
    description: "Map the columns from the GAA file to the eBudget fields and configure import settings.",
  },
  import: { title: "Import to System", description: "Validate and import your GAA data to eBudget." },
};
