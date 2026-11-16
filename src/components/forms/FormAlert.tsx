import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tone = "error" | "success" | "info";

const STYLES: Record<Tone, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-gray-200 bg-gray-50 text-gray-700",
};

export function FormAlert({ tone = "error", children }: { tone?: Tone; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm", STYLES[tone])}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
