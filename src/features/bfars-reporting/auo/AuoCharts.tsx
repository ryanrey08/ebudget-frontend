"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { formatCompactCurrency, formatCompactNumber, formatPercent } from "@/lib/utils/format";

/** One bar per aging bracket in its own color, with the amount above and the share under the label. */
export function AgingBarChart({ data, height = 250 }: { data: { label: string; amount: number; share: number; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: -8, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
          interval={0}
          height={46}
          tick={({ x, y, payload, index }: { x: number | string; y: number | string; payload: { value: string }; index: number }) => (
            <text x={x} y={y} textAnchor="middle" fontSize={12.5}>
              <tspan x={x} dy={14} fill="#1e3a8a">{payload.value}</tspan>
              <tspan x={x} dy={20} fill="#374151">{formatPercent(data[index]?.share ?? 0, 2)}</tspan>
            </text>
          )}
        />
        <YAxis tickFormatter={(v: number) => formatCompactNumber(v)} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontSize: 12 }} width={52} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
        <Bar dataKey="amount" name="Unpaid Obligations" radius={[3, 3, 0, 0]} maxBarSize={64}>
          {data.map((d) => <Cell key={d.label} fill={d.color} />)}
          <LabelList dataKey="amount" position="top" formatter={(v: unknown) => (Number(v) ? formatCompactCurrency(Number(v)) : "")} style={{ fontSize: 12, fontWeight: 700, fill: "#111827" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
