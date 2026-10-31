"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** When given with onPageSizeChange, shows a "per page" selector. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm" aria-label="Pagination">
      <p className="text-gray-500">
        Showing <span className="font-medium text-gray-700">{from}</span>–
        <span className="font-medium text-gray-700">{to}</span> of{" "}
        <span className="font-medium text-gray-700">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {pageSizeOptions && onPageSizeChange && (
          <label className="mr-3 flex items-center gap-2 text-gray-500">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            per page
          </label>
        )}
        <PageButton disabled={page <= 1} onClick={() => onPageChange(page - 1)} label="Previous page">
          <ChevronLeft className="size-4" />
        </PageButton>
        {numbers.map((n, i) => (
          <span key={n} className="flex items-center">
            {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
            <PageButton active={n === page} onClick={() => onPageChange(n)} label={`Page ${n}`}>
              {n}
            </PageButton>
          </span>
        ))}
        <PageButton disabled={page >= pages} onClick={() => onPageChange(page + 1)} label="Next page">
          <ChevronRight className="size-4" />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:opacity-40",
        active ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100",
      )}
    >
      {children}
    </button>
  );
}
