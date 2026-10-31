"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart } from "@/components/charts/DonutChart";
import { getAllotmentClass } from "@/lib/constants/allotment-classes";
import { formatCompactCurrency, formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import type { ClassAllocation } from "../types";

export function AllocationCard({ data, loading }: { data?: ClassAllocation[]; loading: boolean }) {
  const total = data?.reduce((s, d) => s + d.amount, 0) ?? 0;
  const slices =
    data?.map((d) => ({ name: d.allotmentClass, value: d.amount, color: getAllotmentClass(d.allotmentClass).color })) ?? [];

  return (
    <Card>
      <CardHeader title="Allocation by Allotment Class" description="Share of total allotments" />
      <CardBody>
        {loading || !data ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <DonutChart data={slices} centerValue={formatCompactCurrency(total)} centerLabel="Total Allotments" />
            <ul className="space-y-4">
              {slices.map((s) => (
                <li key={s.name} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-sm">
                  <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="font-medium text-gray-800">{s.name}</span>
                  <span className="text-gray-600 tabular-nums">{formatPercent(safeRatio(s.value, total), 1)}</span>
                  <span className="text-right font-medium text-gray-800 tabular-nums">₱{formatNumber(s.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
