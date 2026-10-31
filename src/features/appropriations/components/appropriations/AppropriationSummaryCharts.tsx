"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart } from "@/components/charts/DonutChart";
import { getAllotmentClass } from "@/lib/constants/allotment-classes";
import { formatCompactCurrency, formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";
import type { AppropriationSummary } from "../../types";

const FUND_COLORS = ["#2f7cf6", "#f7a01d", "#3cb455", "#ec2027", "#6b7280"];

export function AppropriationSummaryCharts({ summary, loading }: { summary?: AppropriationSummary; loading: boolean }) {
  const total = summary?.totalAmount ?? 0;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900">Appropriation Summary by Allotment Class</h2>
        {loading || !summary ? (
          <Skeleton className="mt-5 h-24 w-full" />
        ) : (
          <>
            <div className="mt-5 flex h-9 overflow-hidden rounded" role="img" aria-label="Share of appropriations by allotment class">
              {summary.byClass
                .filter((c) => c.amount > 0)
                .map((c) => {
                  const share = safeRatio(c.amount, total);
                  return (
                    <div
                      key={c.allotmentClass}
                      className="flex items-center justify-center text-sm font-semibold text-white"
                      style={{ width: `${share * 100}%`, backgroundColor: getAllotmentClass(c.allotmentClass).color }}
                      title={`${c.allotmentClass}: ${formatPercent(share, 1)}`}
                    >
                      {share >= 0.08 && formatPercent(share, 1)}
                    </div>
                  );
                })}
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {summary.byClass.map((c) => (
                <li key={c.allotmentClass}>
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <span className="size-3 rounded-full" style={{ backgroundColor: getAllotmentClass(c.allotmentClass).color }} aria-hidden />
                    {c.allotmentClass}
                  </span>
                  <span className="mt-1 block text-sm text-gray-900 tabular-nums">{formatCurrency(c.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900">Appropriation Summary by Fund Source</h2>
        {loading || !summary ? (
          <Skeleton className="mt-5 h-40 w-full" />
        ) : (
          <div className="mt-2 grid items-center gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <DonutChart
              height={180}
              data={summary.byFundSource.map((f, i) => ({ name: `${f.code} - ${f.name}`, value: f.amount, color: FUND_COLORS[i % FUND_COLORS.length] }))}
              centerValue={formatCompactCurrency(total)}
              centerLabel="Total"
            />
            <ul className="space-y-3 text-sm">
              {summary.byFundSource.map((f, i) => (
                <li key={f.code} className="flex gap-2">
                  <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: FUND_COLORS[i % FUND_COLORS.length] }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-gray-700">
                      {f.code} - {f.name}
                    </span>
                    <span className="flex justify-between gap-2 text-gray-900 tabular-nums">
                      {formatCurrency(f.amount)}
                      <span className="text-gray-500">{formatPercent(safeRatio(f.amount, total), 1)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
