import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { DashboardOverview, Transaction } from "@/features/dashboard/types";

/**
 * Dashboard: summary cards (appropriations, allotments, obligations,
 * balances, utilization), allocation/utilization charts and recent
 * transactions. In mock mode every figure is computed from the same
 * appropriation, allotment and obligation records the other pages use.
 */
export const dashboardService = {
  getOverview: (params: { fiscalYear: number }) => apiClient.get<DashboardOverview>(ENDPOINTS.dashboard.overview, params),
  getRecentTransactions: (params: { fiscalYear: number; limit?: number }) =>
    apiClient.get<Transaction[]>(ENDPOINTS.dashboard.recentTransactions, params),
};
