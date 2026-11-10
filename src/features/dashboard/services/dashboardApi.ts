import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { dashboardService } from "@/services/dashboard.service";
import type { DashboardOverview, Transaction } from "../types";

export const dashboardApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboardOverview: build.query<DashboardOverview, { fiscalYear: number }>({
      queryFn: (params) => fromService(() => dashboardService.getOverview(params)),
      providesTags: ["Dashboard"],
    }),
    getRecentTransactions: build.query<Transaction[], { fiscalYear: number; limit?: number }>({
      queryFn: (params) => fromService(() => dashboardService.getRecentTransactions(params)),
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetDashboardOverviewQuery, useGetRecentTransactionsQuery } = dashboardApi;
