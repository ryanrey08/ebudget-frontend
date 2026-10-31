"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DonutChart } from "@/components/charts/DonutChart";
import { formatCompactCurrency, formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";

/** RAOMO-style charts: top UACS codes by allotment and a utilization donut. */
export function RegistryUacsCharts({
  code,
  byUacs,
  totals,
}: {
  code: string;
  byUacs: { uacs: string; label: string; amount: number }[];
  totals: { allotments: number; obligations: number; disbursements: number; balance: number };
}) {
  const max = Math.max(1, ...byUacs.map((u) => u.amount));
  const slices = [
    { name: "Disbursements", value: totals.disbursements, color: "#ec2027" },
    { name: "Remaining Obligations", value: Math.max(totals.obligations - totals.disbursements, 0), color: "#2f7cf6" },
    { name: "Available Balance", value: Math.max(totals.balance, 0), color: "#3cb455" },
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title={`Top ${code} UACS`} description="By allotment amount" />
        <CardBody>
          {byUacs.length === 0 ? (
            <p className="text-sm text-gray-500">No allotments yet.</p>
          ) : (
            <ul className="space-y-3">
              {byUacs.slice(0, 6).map((u) => (
                <li key={u.uacs} className="grid grid-cols-[minmax(0,13rem)_1fr] items-center gap-3 text-sm">
                  <span className="truncate text-right text-blue-900" title={`${u.uacs} - ${u.label}`}>{u.uacs} - {u.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-5 rounded-sm bg-brand-600" style={{ width: `${Math.max((u.amount / max) * 75, 2)}%` }} />
                    <span className="text-xs font-medium whitespace-nowrap text-gray-900 tabular-nums">{formatCurrency(u.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`${code} Utilization`} />
        <CardBody className="grid items-center gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <DonutChart height={210} data={slices} centerValue={formatCompactCurrency(totals.allotments)} centerLabel="Total Allotment" />
          <ul className="space-y-4 text-sm">
            {slices.map((s) => (
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
    </div>
  );
}
