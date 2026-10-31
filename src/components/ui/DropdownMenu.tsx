"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils/cn";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Button that opens a small menu of links/actions. */
export function DropdownMenu({
  trigger,
  items,
  label,
  align = "right",
  triggerClassName,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  label: string;
  align?: "left" | "right";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-30 mt-1 min-w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const className = cn(
              "flex w-full items-center gap-2 px-3 py-2 text-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50",
              item.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50",
            );
            const content = (
              <>
                {Icon && <Icon className="size-4" aria-hidden />}
                {item.label}
              </>
            );
            return item.href && !item.disabled ? (
              <Link key={item.label} role="menuitem" href={item.href} className={className} onClick={close}>
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                className={className}
                onClick={() => {
                  close();
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
