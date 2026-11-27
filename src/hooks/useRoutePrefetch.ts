"use client";

import { useCallback } from "react";
import { useAppDispatch } from "@/store/hooks";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { ROUTES } from "@/lib/constants/routes";
import { ALLOTMENT_CLASSES } from "@/lib/constants/allotment-classes";
import { dashboardApi } from "@/features/dashboard/services/dashboardApi";
import { obligationsApi } from "@/features/obligation-management/services/obligationsApi";
import { appropriationsApi } from "@/features/appropriations/services/appropriationsApi";
import { allotmentsApi } from "@/features/allotments/services/allotmentsApi";
import { masterDataApi } from "@/features/master-data/services/masterDataApi";
import { ALL_FISCAL_YEARS } from "@/hooks/useBackendFiscalYear";
import { isBackendData } from "@/config/api.config";
import { allotmentClassesApi } from "@/features/allotment-classes/services/allotmentClassesApi";
import { reportsApi } from "@/features/reports/services/reportsApi";

/** Cached data younger than this (seconds) is not fetched again on hover. */
const FRESH_FOR = 60;
const opts = { ifOlderThan: FRESH_FOR } as const;

/**
 * Warms RTK Query's cache for a page's first-screen queries when the user
 * hovers or focuses its link, so the data is usually there by the time the
 * page mounts. The arguments must match the page's initial query arguments
 * exactly (key order does not matter), otherwise the prefetch is wasted.
 */
export function useRoutePrefetch() {
  const dispatch = useAppDispatch();
  const fiscalYear = useFiscalYear();

  return useCallback(
    (href: string) => {
      const fy = { fiscalYear };
      switch (href) {
        case ROUTES.dashboard:
          dispatch(dashboardApi.util.prefetch("getDashboardOverview", fy, opts));
          dispatch(dashboardApi.util.prefetch("getRecentTransactions", { fiscalYear, limit: 6 }, opts));
          return;
        case ROUTES.obligationManagement:
          dispatch(
            obligationsApi.util.prefetch(
              "getObligations",
              { fiscalYear, tab: "", allotmentClass: "", fundSource: "", status: "", dateFrom: `${fiscalYear}-01-01`, dateTo: `${fiscalYear}-12-31`, search: "", page: 1, pageSize: 10 },
              opts,
            ),
          );
          dispatch(obligationsApi.util.prefetch("getObligationSummary", fy, opts));
          dispatch(appropriationsApi.util.prefetch("getAppropriationLookups", undefined, opts));
          return;
        case ROUTES.appropriations:
        case ROUTES.allotments:
        case ROUTES.newAllotment:
        case ROUTES.newAppropriation:
          // Backend pages first resolve the header's year to its fiscal-year record.
          if (isBackendData()) dispatch(masterDataApi.util.prefetch("getFiscalYears", ALL_FISCAL_YEARS, opts));
          return;
        case ROUTES.reports:
          dispatch(reportsApi.util.prefetch("getReports", { category: "", search: "" }, opts));
          dispatch(reportsApi.util.prefetch("getReportHistory", undefined, opts));
          return;
      }

      const cls = ALLOTMENT_CLASSES.find((c) => href === ROUTES.allotmentClass(c.slug));
      if (cls) {
        dispatch(allotmentClassesApi.util.prefetch("getAllotmentClassRegistry", { code: cls.code, fiscalYear }, opts));
        dispatch(allotmentsApi.util.prefetch("getAllotments", { fiscalYear, allotmentClass: cls.code, pageSize: 100 }, opts));
        dispatch(allotmentsApi.util.prefetch("getRegistryLookups", cls.code, opts));
        dispatch(appropriationsApi.util.prefetch("getAppropriationSummary", fy, opts));
        dispatch(appropriationsApi.util.prefetch("getAppropriationLookups", undefined, opts));
      }
    },
    [dispatch, fiscalYear],
  );
}
