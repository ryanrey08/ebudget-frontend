import { cn } from "@/lib/utils/cn";

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 font-semibold text-white ring-2 ring-white",
        size === "md" ? "size-10 text-sm" : "size-20 text-2xl",
      )}
    >
      {initials}
    </span>
  );
}
