"use client";

import { isBackendData } from "@/config/api.config";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useGetFiscalYearsQuery } from "@/features/master-data/services/masterDataApi";

/** Arguments shared by every component that needs the fiscal-year list, so they share one cache entry. */
export const ALL_FISCAL_YEARS = { per_page: 100 } as const;

/**
 * The backend fiscal-year record of the year chosen in the header. Backend
 * lists and forms filter by its ULID (`fiscal_year_id`); `record` is
 * undefined while loading or when that year doesn't exist in the backend.
 */
export function useBackendFiscalYear() {
  const year = useFiscalYear();
  const query = useGetFiscalYearsQuery(ALL_FISCAL_YEARS, { skip: !isBackendData() });
  // (Needs fiscal_years.view; without it the backend answers 403 and pages show the error.)
  const record = query.data?.items.find((fy) => fy.year === year);
  return {
    year,
    record,
    id: record?.id,
    all: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error,
    /** Loaded, but the backend has no fiscal year for the header's year. */
    missing: !!query.data && !record,
  };
}
