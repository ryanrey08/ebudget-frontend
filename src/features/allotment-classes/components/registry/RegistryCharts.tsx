"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DonutChart } from "@/components/charts/DonutChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { formatCompactCurrency, formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";

interface Props {
  totals: { allotments: number; obligations: number; disbursements: number; balance: number };
  byTranche: { tranche: string; allotment: number; obligations: number; disbursements: number }[];
  byDepartment: { department: string; amount: number }[];
}

export function RegistryCharts({ totals, byTranche, byDepartment }: Props) {
  const slices = [
    { name: "Obligations", value: totals.obligations, color: "#2f7cf6" },
    { name: "Disbursements", value: totals.disbursements, color: "#ec2027" },
    { name: "Available Balance", value: Math.max(totals.balance, 0), color: "#3cb455" },
  ];
  const maxDept = Math.max(1, ...byDepartment.map((d) => d.amount));
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card>
        <CardHeader title="Utilization Summary" />
        <CardBody className="grid items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[11rem_minmax(0,1fr)]">
          <DonutChart height={190} data={slices} centerValue={formatCompactCurrency(totals.allotments)} centerLabel="Total Allotment" />
          <ul className="space-y-3 text-sm">
            {slices.map((s) => (
              <li key={s.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2">
                <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="text-gray-700">{s.name}</span>
                <span className="text-gray-500 tabular-nums">{formatPercent(safeRatio(s.value, totals.allotments), 1)}</span>
                <span className="col-start-2 col-end-4 font-medium text-gray-900 tabular-nums">{formatCurrency(s.value)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Allotment Trend" description="By tranche" />
        <CardBody>
          <GroupedBarChart
            height={210}
            data={byTranche}
            categoryKey="tranche"
            series={[
              { key: "allotment", label: "Allotment", color: "#2f7cf6" },
              { key: "obligations", label: "Obligations", color: "#ec2027" },
              { key: "disbursements", label: "Disbursements", color: "#3cb455" },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Top Departments" description="By allotment amount" />
        <CardBody>
          {byDepartment.length === 0 ? (
            <p className="text-sm text-gray-500">No allotments yet.</p>
          ) : (
            <ul className="space-y-3.5">
              {byDepartment.slice(0, 6).map((d) => (
                <li key={d.department} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate text-blue-900" title={d.department}>{d.department}</span>
                  <span className="h-2.5 rounded-full bg-gray-100">
                    <span className="block h-full rounded-full bg-blue-500" style={{ width: `${(d.amount / maxDept) * 100}%` }} />
                  </span>
                  <span className="text-right font-medium text-gray-900 tabular-nums">{formatCurrency(d.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
