"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactNumber } from "@/lib/utils/format";
import { ChartLegend } from "./ChartLegend";
import { ChartTooltip } from "./ChartTooltip";
import type { BarSeries } from "./GroupedBarChart";

export function AreaTrendChart({
  data,
  categoryKey,
  series,
  height = 260,
}: {
  data: object[];
  categoryKey: string;
  series: BarSeries[];
  height?: number;
}) {
  return (
    <div>
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis dataKey={categoryKey} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} tick={{ fill: "#4b5563", fontSize: 12 }} />
        <YAxis tickFormatter={(v: number) => formatCompactNumber(v)} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontSize: 12 }} width={56} />
        <Tooltip content={<ChartTooltip />} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
    <ChartLegend series={series} />
    </div>
  );
}
