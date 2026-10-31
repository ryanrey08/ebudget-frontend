import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { DashboardOverview, Transaction } from "../types";

export const dashboardApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboardOverview: build.query<DashboardOverview, { fiscalYear: number }>({
      query: (params) => ({ url: ENDPOINTS.dashboard.overview, params }),
      providesTags: ["Dashboard"],
    }),
    getRecentTransactions: build.query<Transaction[], { fiscalYear: number; limit?: number }>({
      query: (params) => ({ url: ENDPOINTS.dashboard.recentTransactions, params }),
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetDashboardOverviewQuery, useGetRecentTransactionsQuery } = dashboardApi;
