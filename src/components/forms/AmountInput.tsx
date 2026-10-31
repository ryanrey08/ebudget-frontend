"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { fieldClasses } from "@/components/ui/Input";

const format = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Peso amount field: shows thousands separators, reports a number (NaN when empty). */
export function AmountInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string;
  value: number | undefined;
  onChange: (value: number) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState(value && Number.isFinite(value) ? format(value) : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value && Number.isFinite(value) ? format(value) : "");
  }, [value, focused]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center border-r border-gray-300 text-sm text-gray-600">
        ₱
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={() => {
          setFocused(true);
          setText((t) => t.replace(/,/g, ""));
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, "");
          setText(raw);
          onChange(raw === "" ? Number.NaN : Number(raw));
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        className={cn(fieldClasses, "h-10 pr-3 pl-13 tabular-nums", invalid && "border-red-400 focus:border-red-500 focus:ring-red-500/20")}
      />
    </div>
  );
}
