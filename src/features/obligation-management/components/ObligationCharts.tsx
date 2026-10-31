"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartLegend } from "@/components/charts/ChartLegend";
import { DonutChart } from "@/components/charts/DonutChart";
import { FISCAL_YEARS, type FiscalYear } from "@/config/site";
import { useAppDispatch } from "@/store/hooks";
import { fiscalYearChanged } from "@/store/slices/filtersSlice";
import { getAllotmentClass } from "@/lib/constants/allotment-classes";
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";
import type { ObligationSummary } from "../types";

interface TooltipPayload {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

function MonthTooltip({ active, payload, label }: { active?: boolean; payload?: readonly TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-gray-900">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-gray-600">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
          {p.name}: <span className="font-medium text-gray-900">{p.dataKey === "count" ? p.value : formatCurrency(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function ObligationCharts({ summary, loading }: { summary?: ObligationSummary; loading: boolean }) {
  const dispatch = useAppDispatch();
  const total = summary?.byClass.reduce((s, c) => s + c.amount, 0) ?? 0;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          title="Obligations by Month"
          action={
            <div className="w-28">
              <Select
                aria-label="Chart fiscal year"
                value={String(summary?.fiscalYear ?? "")}
                onChange={(e) => dispatch(fiscalYearChanged(Number(e.target.value) as FiscalYear))}
                options={FISCAL_YEARS.map((fy) => ({ value: String(fy), label: `FY ${fy}` }))}
              />
            </div>
          }
        />
        <CardBody>
          {loading || !summary ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={summary.monthly} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef0f3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "#e5e7eb" }} tick={{ fill: "#4b5563", fontSize: 12 }} />
                  <YAxis yAxisId="amt" tickFormatter={(v: number) => formatCompactNumber(v)} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontSize: 12 }} width={52} />
                  <YAxis yAxisId="count" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#9ca3af", fontSize: 11 }} width={28} />
                  <Tooltip content={<MonthTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
                  <Bar yAxisId="amt" dataKey="amount" name="Obligation Amount" fill="#2f7cf6" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar yAxisId="amt" dataKey="released" name="Released Amount" fill="#3cb455" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Line yAxisId="count" dataKey="count" name="No. of Obligations" stroke="#ec2027" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <ChartLegend
                series={[
                  { key: "amount", label: "Obligation Amount", color: "#2f7cf6" },
                  { key: "released", label: "Released Amount", color: "#3cb455" },
                  { key: "count", label: "No. of Obligations", color: "#ec2027" },
                ]}
              />
            </>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Obligations by Allotment Class" />
        <CardBody>
          {loading || !summary ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <DonutChart
                height={240}
                data={summary.byClass.map((c) => ({ name: c.allotmentClass, value: c.amount, color: getAllotmentClass(c.allotmentClass).color }))}
                centerValue={formatCompactCurrency(total)}
                centerLabel="Total Obligations"
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
