"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import type { AllotmentClassMeta } from "@/lib/constants/allotment-classes";
import { ROUTES } from "@/lib/constants/routes";
import { useGetAllotmentQuery } from "@/features/allotments/services/allotmentsApi";
import { RegistryAllotmentForm } from "./RegistryAllotmentForm";
import { RegistryAllotmentWizard } from "./RegistryAllotmentWizard";
import { RaofeAllotmentWizard } from "./RaofeAllotmentWizard";
import { registryConfig } from "../../registryConfig";

export function EditRegistryAllotment({ meta, id }: { meta: AllotmentClassMeta; id: string }) {
  const { data, isLoading, error, refetch } = useGetAllotmentQuery(id);
  if (isLoading) return <Skeleton className="h-[640px] w-full rounded-xl" />;
  if (error || !data) return <><PageHeader title="Edit Allotment" /><Card><ErrorState error={error} onRetry={refetch} /></Card></>;
  const a = data.allotment;
  if (a.workflowType !== "registry" || (a.status !== "Draft" && a.status !== "Returned")) {
    return (
      <>
        <PageHeader title={`Edit ${a.allotmentNo}`} />
        <Card>
          <EmptyState
            title="This allotment can't be edited here"
            description="Only draft or returned allotments encoded on this page can be changed."
            action={<Link href={ROUTES.classAllotment(meta.slug, id)} className="text-sm font-medium text-blue-600 hover:underline">View the allotment</Link>}
          />
        </Card>
      </>
    );
  }
  if (registryConfig(meta.slug).viewOnly) return <RaofeAllotmentWizard key={a.id} meta={meta} existing={data} />;
  if (registryConfig(meta.slug).wizard) return <RegistryAllotmentWizard key={a.id} meta={meta} existing={data} />;
  return <RegistryAllotmentForm key={a.id} meta={meta} existing={data} />;
}
