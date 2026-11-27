"use client";

import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGetApprovalWorkflowsQuery } from "@/features/approvals/services/approvalsApi";
import { useCan } from "@/hooks/useCan";
import { ROUTES } from "@/lib/constants/routes";

/** The active `allotment` workflow's steps a submitted tranche goes through. */
export function WorkflowPreview() {
  const canView = useCan("approval_workflows.view");
  const workflows = useGetApprovalWorkflowsQuery({ module: "allotment", is_active: 1 }, { skip: !canView });
  const active = workflows.data?.items[0];
  return (
    <Card>
      <CardHeader title="Approval steps" description="Each tranche is approved on its own. Money counts as released after the last step." />
      <CardBody>
        {!canView ? (
          <p className="text-sm text-gray-500">Submitted tranches go through the active allotment workflow.</p>
        ) : workflows.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : active ? (
          <ol className="space-y-2 text-sm">
            {active.steps.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">{s.sequence}</span>
                <span>
                  <span className="font-medium text-gray-900">{s.name}</span>
                  <span className="block text-xs text-gray-500">
                    {s.user.name}
                    {s.signatory && ` · signs as ${s.signatory.position}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-amber-700">
            The allotment module has no active approval workflow, so tranches can be saved but not submitted.{" "}
            <Link href={ROUTES.approvalWorkflows} className="font-medium underline">
              Set one up
            </Link>
            .
          </p>
        )}
      </CardBody>
    </Card>
  );
}
