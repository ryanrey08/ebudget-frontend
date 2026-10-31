"use client";

import { useId, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

/** Numbered, collapsible form section. Content stays mounted when collapsed so fields keep their values. */
export function FormSection({
  number,
  title,
  open,
  onToggle,
  children,
  id,
}: {
  number: number;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  id?: string;
}) {
  const contentId = useId();
  return (
    <Card id={id} className="scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          {number}
        </span>
        <span className="flex-1 font-semibold text-gray-900">
          {number}. {title}
        </span>
        <ChevronUp className={cn("size-5 text-gray-500 transition-transform", !open && "rotate-180")} aria-hidden />
      </button>
      <div id={contentId} hidden={!open} className="px-5 pb-5">
        {children}
      </div>
    </Card>
  );
}
