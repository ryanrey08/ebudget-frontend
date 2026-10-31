"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, Download, FileText, Info, RotateCw, UserRound, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAppDispatch } from "@/store/hooks";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ROUTES } from "@/lib/constants/routes";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatDateTime, formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetGaaImportResultQuery, useGetGaaRowsQuery } from "../../services/gaaApi";
import { wizardReset } from "../../state/gaaWizardSlice";
import type { GaaImportRowResult, GaaRow, GaaUploadBatch } from "../../types";
import { gaaDataColumns, pesoCell } from "./gaaColumns";

type ResultRow = GaaRow & { result: GaaImportRowResult };

const dataColumns = gaaDataColumns.map((c) =>
  c.key === "amount" ? { ...c, cell: (r: GaaRow) => pesoCell(r.amount) } : c,
) as Column<ResultRow>[];

const columns: Column<ResultRow>[] = [
  ...dataColumns.filter((c) => c.key !== "program"),
  { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.result.status} /> },
  {
    key: "remarks",
    header: "Remarks",
    className: "min-w-40",
    cell: (r) =>
      r.result.remarks ? (
        <span className={r.result.status === "Failed" ? "text-xs font-medium text-red-600" : "text-xs text-gray-600"}>
          {r.result.remarks}
        </span>
      ) : (
        <span className="text-gray-400">-</span>
      ),
  },
];

export function ImportResultStep({ batch }: { batch: GaaUploadBatch }) {
  const dispatch = useAppDispatch();
  const result = useGetGaaImportResultQuery(batch.id);
  const rows = useGetGaaRowsQuery(batch.id);
  const [errorLog, setErrorLog] = useState(false);

  const merged = useMemo<ResultRow[] | undefined>(() => {
    if (!result.data || !rows.data) return undefined;
    const byRow = new Map(result.data.results.map((r) => [r.rowNo, r]));
    return rows.data
      .filter((r) => byRow.has(r.rowNo))
      .map((r) => ({ ...r, result: byRow.get(r.rowNo)! }))
      .filter((r) => !errorLog || r.result.status !== "Imported");
  }, [result.data, rows.data, errorLog]);
  const paging = useClientPagination(merged, 10);

  if (result.error) return <ErrorState error={result.error} onRetry={result.refetch} />;
  const data = result.data;
  const loading = result.isLoading || rows.isLoading;
  const pct = (n: number) => formatPercent(safeRatio(n, data?.total ?? 0), 1);

  const downloadReport = () => {
    if (!merged || !data) return;
    downloadCsv(
      `${batch.fileName.replace(/\.\w+$/, "")}-import-report`,
      toCsv(
        ["Row", "Org Code", "Organization/Office", "UACS Code", "Description", "Appropriation", "Fund Source", "Allotment Class", "Status", "Remarks"],
        merged.map((r) => [r.rowNo, r.orgCode, r.office, r.uacsObjectCode, r.description, r.amount, r.fundSource, r.allotmentClass, r.result.status, r.result.remarks]),
      ),
    );
  };

  return (
    <div className="space-y-5">
      {loading || !data ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-green-200 bg-green-50/70 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="size-12 shrink-0 fill-green-600 text-white" aria-hidden />
            <div>
              <p className="text-xl font-bold text-green-800">Import Completed Successfully!</p>
              <p className="text-sm text-green-900">
                {formatNumber(data.importedCount)} of {formatNumber(data.total)} records from {batch.fileName} were imported to FY{" "}
                {batch.fiscalYear} appropriations.
              </p>
            </div>
          </div>
          <div className="space-y-1.5 text-sm text-gray-700 md:border-l md:border-green-200 md:pl-6">
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden /> {formatDateTime(data.importedAt)}
            </p>
            <p className="flex items-center gap-2">
              <UserRound className="size-4" aria-hidden /> {data.importedBy}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Total Records" value={formatNumber(data?.total ?? 0)} caption="Rows in file" icon={FileText} iconTone="dark" loading={loading} />
        <StatCard label="Imported Records" value={formatNumber(data?.importedCount ?? 0)} caption={pct(data?.importedCount ?? 0)} captionClassName="font-medium text-green-600" icon={CheckCircle2} iconTone="green" loading={loading} />
        <StatCard label="Errors" value={formatNumber(data?.failedCount ?? 0)} caption={pct(data?.failedCount ?? 0)} captionClassName="font-medium text-red-600" icon={XCircle} iconTone="red" loading={loading} />
        <StatCard label="Warnings" value={formatNumber(data?.warningCount ?? 0)} caption={pct(data?.warningCount ?? 0)} captionClassName="font-medium text-amber-600" icon={AlertTriangle} iconTone="amber" loading={loading} />
        <StatCard label="Skipped" value={formatNumber(data?.skippedCount ?? 0)} caption={pct(data?.skippedCount ?? 0)} captionClassName="font-medium text-blue-600" icon={Info} iconTone="blue" loading={loading} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Import Results"
          description={errorLog ? "Showing rows that failed, were skipped or have warnings." : "Detailed list of records processed during import."}
          className="pb-4"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadReport} disabled={!merged?.length}>
                <Download className="size-4" /> Download Report
              </Button>
              <Button variant="outline" onClick={() => setErrorLog((v) => !v)} aria-pressed={errorLog}>
                <FileText className="size-4" /> {errorLog ? "Show All Rows" : "View Error Log"}
              </Button>
              <Link
                href={ROUTES.appropriations}
                className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                View Appropriations
              </Link>
              <Button onClick={() => dispatch(wizardReset())}>
                <RotateCw className="size-4" /> Import Again
              </Button>
            </div>
          }
        />
        <DataTable
          dense
          columns={columns}
          rows={paging.pageItems}
          rowKey={(r) => String(r.rowNo)}
          loading={loading}
          emptyTitle={errorLog ? "No issues in this import" : "No rows"}
          emptyDescription={errorLog ? "Every row was imported without warnings." : undefined}
          caption="GAA import results"
        />
        {paging.total > 0 && (
          <div className="border-t border-gray-100">
            <Pagination
              page={paging.page}
              pageSize={paging.pageSize}
              total={paging.total}
              onPageChange={paging.setPage}
              pageSizeOptions={[10, 25, 50]}
              onPageSizeChange={paging.setPageSize}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
