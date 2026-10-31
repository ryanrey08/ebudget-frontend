import { cn } from "@/lib/utils/cn";

const tones = {
  blue: "bg-chart-blue",
  green: "bg-chart-green",
  amber: "bg-chart-amber",
  red: "bg-chart-red",
} as const;

const tracks = {
  blue: "bg-blue-100",
  green: "bg-green-100",
  amber: "bg-amber-100",
  red: "bg-red-100",
} as const;

export function ProgressBar({
  value,
  tone = "blue",
  className,
  label,
}: {
  /** 0..1 */
  value: number;
  tone?: keyof typeof tones;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", tracks[tone], className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
