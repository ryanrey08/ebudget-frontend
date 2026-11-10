"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend } from "@/components/charts/ChartLegend";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { formatCompactNumber } from "@/lib/utils/format";
import { MRD_OBJECTS, type monthlyTrend } from "./document";

/** Monthly disbursements stacked by object class; months after the reporting month are faded, as in the mockup. */
export function MonthlyTrendChart({ data, month, height = 250 }: { data: ReturnType<typeof monthlyTrend>; month: number; height?: number }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "#e5e7eb" }} interval={0} tick={{ fill: "#4b5563", fontSize: 12 }} />
          <YAxis tickFormatter={(v: number) => formatCompactNumber(v)} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontSize: 12 }} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
          {MRD_OBJECTS.map((o) => (
            <Bar key={o.code} dataKey={o.code} name={o.legend} stackId="mrd" fill={o.color} maxBarSize={34}>
              {data.map((d) => <Cell key={d.month} fillOpacity={d.monthNo > month ? 0.3 : 1} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend series={MRD_OBJECTS.map((o) => ({ key: o.code, label: o.legend, color: o.color }))} />
    </div>
  );
}
