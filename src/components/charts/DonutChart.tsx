"use client";

import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

const RADIAN = Math.PI / 180;

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  height = 260,
}: {
  data: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip content={<ChartTooltip />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="52%"
          outerRadius="92%"
          startAngle={90}
          endAngle={-270}
          stroke="#fff"
          strokeWidth={2}
          labelLine={false}
          isAnimationActive
          label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
            if (!total || !value) return null;
            const r = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) / 2;
            const x = Number(cx) + r * Math.cos(-(midAngle ?? 0) * RADIAN);
            const y = Number(cy) + r * Math.sin(-(midAngle ?? 0) * RADIAN);
            const pct = (Number(value) / total) * 100;
            if (pct < 5) return null;
            return (
              <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
                {pct.toFixed(1)}%
              </text>
            );
          }}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
          <Label
            content={({ viewBox }) => {
              const { cx, cy } = viewBox as { cx: number; cy: number };
              return (
                <g>
                  <text x={cx} y={cy - 6} textAnchor="middle" fontSize={22} fontWeight={700} fill="#111827">
                    {centerValue}
                  </text>
                  <text x={cx} y={cy + 16} textAnchor="middle" fontSize={12} fill="#6b7280">
                    {centerLabel}
                  </text>
                </g>
              );
            }}
          />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
