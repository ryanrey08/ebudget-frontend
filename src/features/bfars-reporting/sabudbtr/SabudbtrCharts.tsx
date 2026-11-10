"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend } from "@/components/charts/ChartLegend";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { formatCompactCurrency, formatCompactNumber } from "@/lib/utils/format";
import type { monthlyTotals } from "./document";

const SERIES = [
  { key: "utilizations", label: "Utilizations", color: "#1f6fe5" },
  { key: "disbursements", label: "Disbursements", color: "#ef3b3b" },
];

/** Utilizations vs. disbursements for each month of the quarter, with value labels as in the mockup. */
export function MonthlyUtilizationChart({ data, height = 250 }: { data: ReturnType<typeof monthlyTotals>; height?: number }) {
  // Round axis steps (1–2–5) with headroom for the value labels, like the mockup's 0–50M axis.
  const peak = Math.max(1, ...data.flatMap((d) => [d.utilizations, d.disbursements]));
  const pow = 10 ** Math.floor(Math.log10(peak / 5));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((x) => x >= peak / 5)!;
  const ticks = Array.from({ length: Math.ceil((peak * 1.1) / step) + 1 }, (_, i) => i * step);
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: -8, bottom: 0 }} barCategoryGap="22%" barGap={6}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "#e5e7eb" }} tick={{ fill: "#4b5563", fontSize: 12 }} />
          <YAxis domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tickFormatter={(v: number) => formatCompactNumber(v)} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontSize: 12 }} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={64} radius={[2, 2, 0, 0]}>
              <LabelList dataKey={s.key} position="top" formatter={(v: unknown) => (Number(v) ? formatCompactCurrency(Number(v)) : "")} style={{ fill: "#1f2937", fontSize: 11 }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend series={SERIES} />
    </div>
  );
}
