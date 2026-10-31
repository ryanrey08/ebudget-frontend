"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ROUTES } from "@/lib/constants/routes";
import { useGetObligationQuery } from "../services/obligationsApi";
import { canEditObligation } from "../workflow";
import { ObligationForm } from "./ObligationForm";

export function EditObligationView({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useGetObligationQuery(id);
  if (isLoading) return <Skeleton className="h-[640px] w-full rounded-xl" />;
  if (error || !data) {
    return (
      <>
        <PageHeader title="Edit Obligation" />
        <Card><ErrorState error={error} onRetry={refetch} /></Card>
      </>
    );
  }
  if (!canEditObligation(data.obligation)) {
    return (
      <>
        <PageHeader title={`Edit ${data.obligation.referenceNo}`} />
        <Card>
          <EmptyState
            title="This obligation can no longer be edited"
            description="Only draft or returned obligations can be changed."
            action={<Link href={ROUTES.obligation(id)} className="text-sm font-medium text-blue-600 hover:underline">View the obligation</Link>}
          />
        </Card>
      </>
    );
  }
  return <ObligationForm key={data.obligation.id} existing={data} />;
}
