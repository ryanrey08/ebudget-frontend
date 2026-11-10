"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend } from "@/components/charts/ChartLegend";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { formatCompactCurrency, formatCompactNumber } from "@/lib/utils/format";
import { QRROR_CLASSES, type monthlyByClass } from "./document";

/** The quarter's months as grouped bars per revenue classification, with value labels as in the mockup. */
export function QuarterTrendChart({ data, height = 250 }: { data: ReturnType<typeof monthlyByClass>; height?: number }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: -8, bottom: 0 }} barCategoryGap="22%" barGap={4}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "#e5e7eb" }} tick={{ fill: "#4b5563", fontSize: 12 }} />
          <YAxis tickFormatter={(v: number) => formatCompactNumber(v)} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontSize: 12 }} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
          {QRROR_CLASSES.map((c) => (
            <Bar key={c.code} dataKey={c.code} name={c.name} fill={c.color} maxBarSize={44} radius={[2, 2, 0, 0]}>
              <LabelList dataKey={c.code} position="top" formatter={(v: unknown) => (Number(v) ? formatCompactCurrency(Number(v)) : "")} style={{ fill: "#1f2937", fontSize: 11 }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend series={QRROR_CLASSES.map((c) => ({ key: c.code, label: c.name, color: c.color }))} />
    </div>
  );
}
