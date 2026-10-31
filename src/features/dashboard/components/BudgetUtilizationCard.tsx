"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import type { ClassUtilization } from "../types";

export function BudgetUtilizationCard({ data, loading }: { data?: ClassUtilization[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader title="Budget Utilization" description="Appropriations, allotments and obligations by allotment class" />
      <CardBody>
        {loading || !data ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <GroupedBarChart
            data={data}
            categoryKey="allotmentClass"
            series={[
              { key: "appropriations", label: "Appropriations", color: "#2f7cf6" },
              { key: "allotments", label: "Allotments", color: "#ec2027" },
              { key: "obligations", label: "Obligations", color: "#3cb455" },
            ]}
          />
        )}
      </CardBody>
    </Card>
  );
}
