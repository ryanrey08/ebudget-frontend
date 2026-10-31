"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/Input";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="sr-only" htmlFor={`search-${label}`}>
        {label}
      </label>
      <Input
        id={`search-${label}`}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        leftIcon={<Search className="size-4" />}
        rightSlot={
          value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-md p-1.5 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null
        }
        className="[&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}
