import Image from "next/image";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

/** Horizontal lock-up used in the header: emblem + wordmark. */
export function LogoLockup({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Image src={siteConfig.emblem} alt="" width={353} height={223} priority className="h-10 w-auto" />
      {!compact && (
        <span className="text-[1.75rem] leading-none font-extrabold tracking-tight">
          <span className="text-brand-600">e</span>
          <span className="text-gray-900">Budget</span>
        </span>
      )}
      <span className="sr-only">{siteConfig.name}</span>
    </span>
  );
}

/** Full stacked logo (official artwork). */
export function LogoFull({ className }: { className?: string }) {
  return (
    <Image
      src={siteConfig.logo}
      alt={`${siteConfig.name} logo`}
      width={412}
      height={338}
      priority
      className={cn("h-auto w-56", className)}
    />
  );
}
