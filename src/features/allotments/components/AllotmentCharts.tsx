"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart } from "@/components/charts/DonutChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { getAllotmentClass } from "@/lib/constants/allotment-classes";
import { formatCompactCurrency, formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";
import type { AllotmentSummary } from "../types";

export function AllotmentCharts({ summary, loading }: { summary?: AllotmentSummary; loading: boolean }) {
  const total = summary?.byClass.reduce((s, c) => s + c.amount, 0) ?? 0;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Allotment Releases by Month" />
        <CardBody>
          {loading || !summary ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <GroupedBarChart
              height={240}
              data={summary.monthly}
              categoryKey="month"
              series={[
                { key: "allotted", label: "Allotted", color: "#2f7cf6" },
                { key: "released", label: "Released", color: "#ec2027" },
                { key: "unreleased", label: "Unreleased", color: "#3cb455" },
              ]}
            />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Allotment by Class" />
        <CardBody>
          {loading || !summary ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <DonutChart
                height={240}
                data={summary.byClass.map((c) => ({ name: c.allotmentClass, value: c.amount, color: getAllotmentClass(c.allotmentClass).color }))}
                centerValue={formatCompactCurrency(total)}
                centerLabel="Total Allotments"
              />
              <ul className="space-y-4">
                {summary.byClass.map((c) => (
                  <li key={c.allotmentClass} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 text-sm">
                    <span className="size-3 rounded-full" style={{ backgroundColor: getAllotmentClass(c.allotmentClass).color }} aria-hidden />
                    <span className="font-medium text-gray-800">{c.allotmentClass}</span>
                    <span className="text-gray-600 tabular-nums">{formatPercent(safeRatio(c.amount, total), 1)}</span>
                    <span className="col-start-2 col-end-4 text-gray-900 tabular-nums">{formatCurrency(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
