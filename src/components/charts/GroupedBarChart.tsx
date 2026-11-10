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

/** X-axis label split over several lines so long category names stay readable. */
function WrappedTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const lines: string[] = [];
  for (const word of String(payload?.value ?? "").split(" ")) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= 16) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return (
    <text x={x} y={y} textAnchor="middle" fill="#4b5563" fontSize={12}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i ? 14 : 12}>{l}</tspan>
      ))}
    </text>
  );
}

export function GroupedBarChart({
  data,
  categoryKey,
  series,
  height = 280,
  wrapTicks = false,
}: {
  data: object[];
  categoryKey: string;
  series: BarSeries[];
  height?: number;
  /** Show every category label, wrapped over several lines. */
  wrapTicks?: boolean;
}) {
  return (
    <div>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={6} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis
          dataKey={categoryKey}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
          tick={wrapTicks ? <WrappedTick /> : { fill: "#4b5563", fontSize: 13 }}
          interval={wrapTicks ? 0 : undefined}
          height={wrapTicks ? 52 : undefined}
        />
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
