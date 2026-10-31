"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { Card } from "@/components/ui/Card";
import { siteConfig } from "@/config/site";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useGetDashboardOverviewQuery } from "../services/dashboardApi";
import { AllocationCard } from "./AllocationCard";
import { BudgetUtilizationCard } from "./BudgetUtilizationCard";
import { QuickActions } from "./QuickActions";
import { RecentTransactionsCard } from "./RecentTransactionsCard";
import { SummaryCards } from "./SummaryCards";

export function DashboardView() {
  const fiscalYear = useFiscalYear();
  const { data, isLoading, isFetching, error, refetch } = useGetDashboardOverviewQuery({ fiscalYear });
  const loading = isLoading || isFetching;

  return (
    <>
      <PageHeader title="Dashboard" description={siteConfig.tagline} />
      {error && !loading ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : (
        <div className="space-y-5">
          <SummaryCards summary={data?.summary} loading={loading} />
          <div className="grid gap-5 xl:grid-cols-2">
            <BudgetUtilizationCard data={data?.utilization} loading={loading} />
            <AllocationCard data={data?.allocation} loading={loading} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            <RecentTransactionsCard />
            <QuickActions />
          </div>
        </div>
      )}
    </>
  );
}
