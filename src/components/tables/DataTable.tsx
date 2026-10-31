import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide below the given breakpoint to keep tables readable on small screens. */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "wide";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
  footerRow?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  skeletonRows?: number;
  dense?: boolean;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" };
const hideClass = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  wide: "hidden min-[1700px]:table-cell",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filters.",
  caption,
  footerRow,
  onRowClick,
  rowClassName,
  skeletonRows = 6,
  dense,
}: DataTableProps<T>) {
  const cellPad = dense ? "px-2.5 first:pl-5 last:pr-5" : "px-4 first:pl-5 last:pr-5";
  if (error && !loading) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full", dense ? "min-w-[560px] text-[13px]" : "min-w-[640px] text-sm")}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-gray-50 text-gray-700">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  cellPad, "py-3 font-semibold whitespace-nowrap",
                  alignClass[col.align ?? "left"],
                  col.hideBelow && hideClass[col.hideBelow],
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className={cn(cellPad, "py-3.5", col.hideBelow && hideClass[col.hideBelow])}>
                      <Skeleton className="h-4 w-full max-w-36" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "text-gray-700 transition-colors hover:bg-gray-50/80",
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        cellPad,
                        "py-3",
                        alignClass[col.align ?? "left"],
                        col.hideBelow && hideClass[col.hideBelow],
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
        {footerRow && !loading && rows && rows.length > 0 && <tfoot>{footerRow}</tfoot>}
      </table>
      {!loading && rows?.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
    </div>
  );
}
