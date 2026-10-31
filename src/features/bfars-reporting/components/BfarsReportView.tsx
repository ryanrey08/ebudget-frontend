"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import type { BfarsReportMeta } from "@/lib/constants/bfars";
import { QUARTER_OPTIONS } from "@/lib/constants/options";
import { cn } from "@/lib/utils/cn";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { useGetBfarsReportQuery } from "../services/bfarsApi";
import { formatCell } from "../format";
import type { BfarsReportParams } from "../types";

const SERIES_COLORS = ["#2f7cf6", "#ec2027", "#3cb455", "#f7a01d", "#6b7280"];

export function BfarsReportView({ meta }: { meta: BfarsReportMeta }) {
  const fiscalYear = useFiscalYear();
  const [quarter, setQuarter] = useState<BfarsReportParams["quarter"]>("Q1");
  const { data, isLoading, isFetching, error, refetch } = useGetBfarsReportQuery({ id: meta.id, fiscalYear, quarter });
  const loading = isLoading || isFetching;

  const exportCsv = () => {
    if (!data) return;
    const rows = [...data.rows, ...(data.totals ? [data.totals] : [])];
    downloadCsv(
      `ebudget-bfars-${meta.number}-${meta.code.toLowerCase()}-fy${fiscalYear}-${quarter.toLowerCase()}`,
      toCsv(
        data.columns.map((c) => c.label),
        rows.map((r) => data.columns.map((c) => r[c.key])),
      ),
    );
  };

  const numericAlign = (type: string) => (type === "text" || type === "date" ? "text-left" : "text-right");

  return (
    <>
      <PageHeader
        title={`BFARS ${meta.number}`}
        description={`${meta.title} (${meta.code})`}
        actions={
          <>
            <div className="w-32">
              <Select
                aria-label="Reporting quarter"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value as BfarsReportParams["quarter"])}
                options={QUARTER_OPTIONS}
              />
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={!data || loading}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Button variant="secondary" onClick={() => window.print()} disabled={!data || loading}>
              <Printer className="size-4" /> Print
            </Button>
          </>
        }
      />

      {error && !loading ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {(data?.metrics ?? Array.from({ length: 4 }, () => null)).map((m, i) => (
              <Card key={m?.label ?? i} className="p-5">
                {loading || !m ? (
                  <>
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-3 h-7 w-40" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-600">{m.label}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                      {m.type === "percent" ? formatPercent(m.value) : m.type === "currency" ? formatCurrency(m.value) : m.value}
                    </p>
                  </>
                )}
              </Card>
            ))}
          </div>

          {data?.chart && (
            <Card className="no-print">
              <CardBody>
                {loading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : (
                  <GroupedBarChart
                    data={data.rows}
                    categoryKey={data.chart.categoryKey}
                    series={data.chart.seriesKeys.map((key, i) => ({
                      key,
                      label: data.columns.find((c) => c.key === key)?.label ?? key,
                      color: SERIES_COLORS[i % SERIES_COLORS.length],
                    }))}
                  />
                )}
              </CardBody>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-5 text-center">
              <p className="text-xs tracking-wide text-gray-500 uppercase">Republic of the Philippines</p>
              {loading || !data ? (
                <Skeleton className="mx-auto mt-2 h-5 w-64" />
              ) : (
                <>
                  <p className="mt-1 text-base font-bold text-gray-900 uppercase">{data.agency}</p>
                  <p className="mt-1 font-semibold text-brand-700">
                    BFARS {meta.number} — {meta.title} ({meta.code})
                  </p>
                  <p className="mt-0.5 text-sm text-gray-600">{data.period} · Amounts in PHP</p>
                </>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <caption className="sr-only">{meta.title}</caption>
                <thead>
                  <tr className="bg-gray-900 text-white">
                    {(data?.columns ?? []).map((c) => (
                      <th key={c.key} scope="col" className={cn("px-3 py-3 text-xs font-semibold first:pl-5 last:pr-5", numericAlign(c.type))}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading || !data
                    ? Array.from({ length: 6 }, (_, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3" colSpan={12}>
                            <Skeleton className="h-4 w-full" />
                          </td>
                        </tr>
                      ))
                    : data.rows.map((row, i) => (
                        <tr key={i} className="text-gray-700 hover:bg-gray-50">
                          {data.columns.map((c) => (
                            <td
                              key={c.key}
                              className={cn("px-3 py-2.5 first:pl-5 last:pr-5", numericAlign(c.type), c.type !== "text" && "whitespace-nowrap tabular-nums")}
                            >
                              {c.key === "status" || c.key === "remarks" ? (
                                <span className={cn("text-xs font-medium", row[c.key] === "Needs Attention" || row[c.key] === "On Hold" ? "text-amber-700" : "text-green-700")}>
                                  {String(row[c.key] ?? "")}
                                </span>
                              ) : (
                                formatCell(row[c.key], c.type)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                </tbody>
                {data?.totals && !loading && (
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold text-gray-900">
                      {data.columns.map((c) => (
                        <td key={c.key} className={cn("px-3 py-3 whitespace-nowrap tabular-nums first:pl-5 last:pr-5", numericAlign(c.type))}>
                          {formatCell(data.totals?.[c.key], c.type)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {data && !loading && (
              <div className="space-y-4 border-t border-gray-100 px-5 py-5 text-xs text-gray-500">
                {data.notes.map((n) => (
                  <p key={n}>Note: {n}</p>
                ))}
                <p className="font-medium text-amber-700">
                  Sample data from the mock API — not an official financial report.
                </p>
                <div className="grid gap-6 pt-4 text-sm text-gray-700 sm:grid-cols-3">
                  {["Prepared by", "Reviewed by", "Certified correct"].map((label) => (
                    <div key={label}>
                      <p className="text-xs text-gray-500">{label}:</p>
                      <div className="mt-8 border-t border-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
