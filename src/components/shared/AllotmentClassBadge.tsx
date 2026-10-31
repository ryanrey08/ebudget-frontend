import { cn } from "@/lib/utils/cn";

const tones: Record<string, string> = {
  RAOPS: "bg-blue-100 text-blue-700",
  RAOMO: "bg-red-100 text-red-700",
  RAOCO: "bg-green-100 text-green-700",
  RAOFE: "bg-amber-100 text-amber-800",
};

/** Coloured chip for an allotment class code; unknown codes render neutral. */
export function AllotmentClassBadge({ code }: { code: string }) {
  if (!code) return <span className="text-gray-400">—</span>;
  return (
    <span
      className={cn(
        "inline-flex min-w-16 justify-center rounded px-2 py-0.5 text-xs font-semibold",
        tones[code] ?? "bg-gray-100 text-gray-600 ring-1 ring-red-300",
      )}
    >
      {code}
    </span>
  );
}
