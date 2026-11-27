"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DemoDataNotice } from "@/components/backend/DataSourceNotice";
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
  const { data, currentData, isFetching, error, refetch } = useGetDashboardOverviewQuery({ fiscalYear });
  // Skeletons only while there is no data for the current arguments; a
  // background refetch keeps the cached data on screen.
  const loading = isFetching && !currentData;

  return (
    <>
      <PageHeader title="Dashboard" description={siteConfig.tagline} />
      <DemoDataNotice module="dashboard" />
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
