"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactNumber } from "@/lib/utils/format";
import { ChartLegend } from "./ChartLegend";
import { ChartTooltip } from "./ChartTooltip";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

export function GroupedBarChart({
  data,
  categoryKey,
  series,
  height = 280,
}: {
  data: object[];
  categoryKey: string;
  series: BarSeries[];
  height?: number;
}) {
  return (
    <div>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={6} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis dataKey={categoryKey} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} tick={{ fill: "#4b5563", fontSize: 13 }} />
        <YAxis
          tickFormatter={(v: number) => formatCompactNumber(v)}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#4b5563", fontSize: 12 }}
          width={56}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={30} />
        ))}
      </BarChart>
    </ResponsiveContainer>
    <ChartLegend series={series} />
    </div>
  );
}
