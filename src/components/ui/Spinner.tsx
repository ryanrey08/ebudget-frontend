import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <Loader2 className={cn("size-5 animate-spin", className)} aria-hidden />
      <span className={label ? "text-sm text-gray-500" : "sr-only"}>{label ?? "Loading"}</span>
    </span>
  );
}
