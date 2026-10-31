import { useMemo, useState } from "react";

/** Pages an in-memory list; resets to page 1 when the list or page size changes. */
export function useClientPagination<T>(items: T[] | undefined, initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const total = items?.length ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, lastPage);

  const pageItems = useMemo(
    () => items?.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );

  return {
    pageItems,
    page: current,
    pageSize,
    total,
    setPage,
    setPageSize: (size: number) => {
      setPageSizeState(size);
      setPage(1);
    },
  };
}
