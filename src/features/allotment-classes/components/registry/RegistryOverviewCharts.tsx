"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DonutChart } from "@/components/charts/DonutChart";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { formatCompactCurrency, formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";

/** RAOCO-style charts: utilization donut and allotment vs obligations vs disbursements per allotment. */
export function RegistryOverviewCharts({
  code,
  totals,
  byAllotment,
}: {
  code: string;
  totals: { allotments: number; obligations: number; disbursements: number; balance: number };
  byAllotment: { label: string; allotment: number; obligations: number; disbursements: number }[];
}) {
  const slices = [
    { name: "Disbursements", value: totals.disbursements, color: "#2f7cf6" },
    { name: "Obligations", value: Math.max(totals.obligations - totals.disbursements, 0), color: "#ec2027" },
    { name: "Available Balance", value: Math.max(totals.balance, 0), color: "#f7a01d" },
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card>
        <CardHeader title="Allotment Utilization" />
        <CardBody className="grid items-center gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <DonutChart height={210} data={slices} centerValue={formatCompactCurrency(totals.allotments)} centerLabel={`Total Allotment (${code})`} />
          <ul className="space-y-4 text-sm">
            {[
              { ...slices[0] },
              { name: "Obligations", value: totals.obligations, color: "#ec2027" },
              { ...slices[2] },
            ].map((s) => (
              <li key={s.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2">
                <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="text-blue-900">{s.name}</span>
                <span className="text-gray-500 tabular-nums">{formatPercent(safeRatio(s.value, totals.allotments), 1)}</span>
                <span className="col-start-2 col-end-4 font-medium text-gray-900 tabular-nums">{formatCurrency(s.value)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Allotment vs Obligations vs Disbursements" />
        <CardBody>
          {byAllotment.length === 0 ? (
            <p className="text-sm text-gray-500">No approved allotments yet.</p>
          ) : (
            <GroupedBarChart
              height={230}
              data={byAllotment}
              categoryKey="label"
              series={[
                { key: "allotment", label: "Allotments", color: "#2f7cf6" },
                { key: "obligations", label: "Obligations", color: "#ec2027" },
                { key: "disbursements", label: "Disbursements", color: "#3cb455" },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
