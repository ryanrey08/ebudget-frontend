"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ChartLegend } from "@/components/charts/ChartLegend";
import { DonutChart } from "@/components/charts/DonutChart";
import { formatPercent } from "@/lib/utils/format";
import { CLASS_ORDER } from "./document";
import { accomplishment, groupBy, totalsOf, utilization } from "./summary";
import type { QproRow } from "./types";

const TYPE_COLORS: Record<string, string> = {
  "Regular Programs": "#2f7cf6",
  "Support to Operations": "#ec2027",
  "Locally-Funded Projects": "#3cb455",
  "Foreign-Assisted Projects": "#f7a01d",
};

function PercentTooltip({ active, payload, label }: { active?: boolean; payload?: readonly { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-gray-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />{p.name}: {Number(p.value).toFixed(1)}%</p>
      ))}
    </div>
  );
}

/** Physical vs financial accomplishment by allotment class, and the program-type distribution. */
export function QproCharts({ rows }: { rows: QproRow[] }) {
  const byClass = groupBy(rows, "allotmentClass", CLASS_ORDER).map((g) => ({
    cls: g.key,
    target: Number(g.target.toFixed(1)),
    actual: Number(g.actual.toFixed(1)),
    utilization: Number((utilization(g.allotment, g.disbursements) * 100).toFixed(1)),
  }));
  const total = totalsOf(rows);
  const byType = groupBy(rows, "programType").sort((a, b) => b.count - a.count);
  const slices = byType.map((g) => ({ name: g.key, value: g.count, color: TYPE_COLORS[g.key] ?? "#8b5cf6" }));

  return (
    <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Physical vs Financial Accomplishment by Allotment Class" />
        <CardBody>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={byClass} margin={{ top: 20, right: 8, left: -8, bottom: 0 }} barGap={4} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#eef0f3" />
              <XAxis dataKey="cls" tickLine={false} axisLine={{ stroke: "#e5e7eb" }} tick={{ fill: "#4b5563", fontSize: 13 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: "#4b5563", fontSize: 12 }} width={48} />
              <Tooltip content={<PercentTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
              <Bar dataKey="target" name="Physical Target" fill="#2f7cf6" radius={[3, 3, 0, 0]} maxBarSize={44}>
                <LabelList dataKey="target" position="top" formatter={(v: unknown) => `${Number(v).toFixed(0)}%`} fontSize={11} fill="#1d4ed8" />
              </Bar>
              <Bar dataKey="actual" name="Physical Accomplishment" fill="#3cb455" radius={[3, 3, 0, 0]} maxBarSize={44}>
                <LabelList dataKey="actual" position="top" formatter={(v: unknown) => `${Number(v).toFixed(0)}%`} fontSize={11} fill="#15803d" />
              </Bar>
              <Line dataKey="utilization" name="Financial Utilization (%)" stroke="#f7a01d" strokeWidth={2.5} dot={{ r: 5, fill: "#f7a01d" }} />
            </ComposedChart>
          </ResponsiveContainer>
          <ChartLegend
            series={[
              { key: "t", label: "Physical Target", color: "#2f7cf6" },
              { key: "a", label: "Physical Accomplishment", color: "#3cb455" },
              { key: "u", label: "Financial Utilization (%)", color: "#f7a01d" },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Distribution of Physical Accomplishment (by Program Type)" />
        <CardBody className="grid items-center gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <DonutChart height={220} data={slices} centerValue={formatPercent(accomplishment(total.target, total.actual), 1)} centerLabel="Overall Accomplishment" />
          <ul className="space-y-3 text-sm">
            {byType.map((g) => (
              <li key={g.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5">
                <span className="size-3 rounded-full" style={{ backgroundColor: TYPE_COLORS[g.key] ?? "#8b5cf6" }} aria-hidden />
                <span className="text-blue-900">{g.key}</span>
                <span className="font-medium text-gray-900 tabular-nums">{formatPercent(g.count / Math.max(total.count, 1), 1)}</span>
                <span className="col-start-2 col-end-4 text-xs text-gray-500">{g.count} programs/activities · {formatPercent(accomplishment(g.target, g.actual), 1)} accomplished</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
