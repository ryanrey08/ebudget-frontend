"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { DonutChart } from "@/components/charts/DonutChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { formatCompactCurrency, formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";

const COLORS = ["#2f7cf6", "#ec2027", "#3cb455", "#f7a01d", "#8b5cf6", "#0ea5e9", "#64748b"];

export interface ExpenseTypeRow {
  label: string;
  allotment: number;
  obligations: number;
  disbursements: number;
}

/** RAOFE charts: allocation by expense type and allotment vs obligations vs disbursements. */
export function RaofeCharts({ code, rows }: { code: string; rows: ExpenseTypeRow[] }) {
  const [chartType, setChartType] = useState<"bar" | "table">("bar");
  const total = rows.reduce((s, r) => s + r.allotment, 0);
  const slices = rows.map((r, i) => ({ name: r.label, value: r.allotment, color: COLORS[i % COLORS.length] }));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card>
        <CardHeader title={`${code} Allocation by Program/Expense Type`} />
        <CardBody className="grid items-center gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 sm:col-span-2">No approved allotments yet.</p>
          ) : (
            <>
              <DonutChart height={210} data={slices} centerValue={formatCompactCurrency(total)} centerLabel={`Total ${code}`} />
              <ul className="space-y-3 text-sm">
                {slices.map((s) => (
                  <li key={s.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5">
                    <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                    <span className="text-blue-900">{s.name}</span>
                    <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(s.value).replace(".00", "")}</span>
                    <span className="col-start-2 text-xs text-gray-500 tabular-nums">{formatPercent(safeRatio(s.value, total), 1)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Allotment vs Obligations vs Disbursements"
          action={
            <div className="flex items-center gap-2">
              <label htmlFor="raofe-chart-type" className="text-sm text-gray-700">Chart Type</label>
              <Select id="raofe-chart-type" className="w-36" value={chartType} onChange={(e) => setChartType(e.target.value as "bar" | "table")} options={[{ value: "bar", label: "Bar Chart" }, { value: "table", label: "Table" }]} />
            </div>
          }
        />
        <CardBody>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">No approved allotments yet.</p>
          ) : chartType === "bar" ? (
            <GroupedBarChart
              height={230}
              data={rows.map((r) => ({ ...r, label: r.label.length > 22 ? `${r.label.slice(0, 21)}…` : r.label }))}
              categoryKey="label"
              series={[
                { key: "allotment", label: "Allotments", color: "#2f7cf6" },
                { key: "obligations", label: "Obligations", color: "#ec2027" },
                { key: "disbursements", label: "Disbursements", color: "#3cb455" },
              ]}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <caption className="sr-only">Allotment vs obligations vs disbursements by expense type</caption>
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-700">
                    <th scope="col" className="py-2 pr-3">Expense Type</th>
                    <th scope="col" className="py-2 pr-3 text-right">Allotments (₱)</th>
                    <th scope="col" className="py-2 pr-3 text-right">Obligations (₱)</th>
                    <th scope="col" className="py-2 text-right">Disbursements (₱)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td className="py-2 pr-3">{r.label}</td>
                      {[r.allotment, r.obligations, r.disbursements].map((v, i) => (
                        <td key={i} className="py-2 pr-3 text-right tabular-nums last:pr-0">{formatCurrency(v).replace("₱", "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
