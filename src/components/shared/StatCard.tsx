import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";

const iconTones = {
  red: "bg-brand-600 text-white",
  dark: "bg-gray-800 text-white",
  blue: "bg-blue-600 text-white",
  green: "bg-green-600 text-white",
  amber: "bg-amber-500 text-white",
} as const;

export interface StatCardProps {
  label: string;
  value: string;
  caption?: string;
  captionClassName?: string;
  icon: LucideIcon;
  iconTone?: keyof typeof iconTones;
  progress?: { value: number; tone: "blue" | "green" | "amber" | "red" };
  loading?: boolean;
}

export function StatCard({ label, value, caption, captionClassName, icon: Icon, iconTone = "red", progress, loading }: StatCardProps) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", iconTones[iconTone])}>
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {loading ? (
          <>
            <Skeleton className="mt-2 h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-28" />
          </>
        ) : (
          <>
            <p className="mt-1 text-xl font-bold tracking-tight break-words text-gray-900 tabular-nums" title={value}>
              {value}
            </p>
            {caption && <p className={cn("mt-1 text-sm text-gray-500", captionClassName)}>{caption}</p>}
            {progress && <ProgressBar className="mt-3" value={progress.value} tone={progress.tone} label={label} />}
          </>
        )}
      </div>
    </Card>
  );
}
