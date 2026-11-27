import Link from "next/link";
import { Database, FlaskConical } from "lucide-react";
import { isBackendData } from "@/config/api.config";
import { cn } from "@/lib/utils/cn";

/**
 * Shown on modules the backend has no endpoints for yet: in real mode their
 * data still comes from the built-in demo data (see DEMO_ONLY_PATHS).
 */
export function DemoDataNotice({ module, className }: { module: string; className?: string }) {
  if (!isBackendData()) return null;
  return (
    <div role="note" className={cn("no-print mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800", className)}>
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Demo data.</span> The eBudget backend has no {module} endpoints yet, so this page
        shows sample figures, not your records.
      </p>
    </div>
  );
}

/** Replaces a backend-only page in mock mode, where those endpoints don't exist. */
export function BackendRequired({ children }: { children: React.ReactNode }) {
  if (isBackendData()) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <div className="mb-3 rounded-full bg-gray-100 p-3 text-gray-500">
        <Database className="size-6" aria-hidden />
      </div>
      <p className="font-medium text-gray-900">This page needs the eBudget backend</p>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        It works with the backend&apos;s records only, and this build runs in mock mode. Remove{" "}
        <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_API_MODE=mock</code> (real is the default) and restart or rebuild the app.
      </p>
    </div>
  );
}

/** Shown when the header's fiscal year doesn't exist in the backend yet. */
export function MissingFiscalYear({ year }: { year: number }) {
  return (
    <div role="note" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      FY {year} isn&apos;t set up in the backend yet.{" "}
      <Link href="/master-data/fiscal-years" className="font-medium underline">
        Add it under Master Data → Fiscal Years
      </Link>{" "}
      or pick another year in the header.
    </div>
  );
}
