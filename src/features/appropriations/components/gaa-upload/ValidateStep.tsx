"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, Download, FileText, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { FormAlert } from "@/components/forms/FormAlert";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { StatCard } from "@/components/shared/StatCard";
import { useAppDispatch } from "@/store/hooks";
import { useClientPagination } from "@/hooks/useClientPagination";
import { getErrorMessage } from "@/lib/api/error-handler";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import { rowStatus } from "../../gaa/fields";
import { useGetGaaRowsQuery, useValidateGaaMutation } from "../../services/gaaApi";
import { stepChanged } from "../../state/gaaWizardSlice";
import type { GaaIssueCount, GaaRow, GaaRowStatus, GaaUploadBatch } from "../../types";
import { GaaStatusIcon, gaaDataColumns, gaaRemarks } from "./gaaColumns";

type Filter = "all" | GaaRowStatus;

const columns: Column<GaaRow>[] = [
  gaaDataColumns[0],
  { key: "status", header: "Status", align: "center", cell: (r) => <GaaStatusIcon row={r} /> },
  ...gaaDataColumns.slice(1),
  { key: "remarks", header: "Remarks", cell: gaaRemarks, className: "min-w-40" },
];

export function ValidateStep({ batch }: { batch: GaaUploadBatch }) {
  const dispatch = useAppDispatch();
  const [validate, { data: summary, isLoading: validating, error }] = useValidateGaaMutation();
  const rows = useGetGaaRowsQuery(batch.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void validate(batch.id);
  }, [batch.id, validate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.data
      ?.filter((r) => filter === "all" || rowStatus(r) === filter)
      .filter((r) => !q || [r.orgCode, r.uacsObjectCode, r.description, r.office].some((f) => f.toLowerCase().includes(q)));
  }, [rows.data, filter, search]);
  const paging = useClientPagination(filtered, 10);
  const loading = validating || rows.isLoading || rows.isFetching;
  const total = summary?.total ?? 0;
  const pct = (n: number) => formatPercent(safeRatio(n, total), 1);

  const downloadErrors = () => {
    const issues = rows.data?.filter((r) => rowStatus(r) !== "valid") ?? [];
    downloadCsv(
      `${batch.fileName.replace(/\.\w+$/, "")}-error-report`,
      toCsv(
        ["Row", "Status", "Org Code", "UACS Code", "Description", "Appropriation", "Fund Source", "Allotment Class", "Issues"],
        issues.map((r) => [r.rowNo, rowStatus(r) === "error" ? "Error" : "Warning", r.orgCode, r.uacsObjectCode, r.description, r.amount, r.fundSource, r.allotmentClass, [...r.errors, ...r.warnings].join("; ")]),
      ),
    );
  };

  if (error) {
    return <FormAlert>{getErrorMessage(error)}</FormAlert>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Total Records" value={formatNumber(total)} caption="Rows in file" icon={FileText} iconTone="dark" loading={loading} />
        <StatCard label="Valid Records" value={formatNumber(summary?.valid ?? 0)} caption={pct(summary?.valid ?? 0)} captionClassName="font-medium text-green-600" icon={CheckCircle2} iconTone="green" loading={loading} />
        <StatCard label="Records with Errors" value={formatNumber(summary?.errors ?? 0)} caption={pct(summary?.errors ?? 0)} captionClassName="font-medium text-red-600" icon={XCircle} iconTone="red" loading={loading} />
        <StatCard label="Records with Warnings" value={formatNumber(summary?.warnings ?? 0)} caption={pct(summary?.warnings ?? 0)} captionClassName="font-medium text-amber-600" icon={AlertTriangle} iconTone="amber" loading={loading} />
        <StatCard label="Duplicate Records" value={formatNumber(summary?.duplicates ?? 0)} caption={pct(summary?.duplicates ?? 0)} captionClassName="font-medium text-blue-600" icon={Info} iconTone="blue" loading={loading} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 px-5 pt-3 lg:flex-row lg:items-end lg:justify-between">
          <Tabs
            label="Validation result"
            className="border-b-0"
            value={filter}
            onChange={setFilter}
            items={[
              { value: "all", label: "All", count: total },
              { value: "error", label: "Errors", count: summary?.errors ?? 0 },
              { value: "warning", label: "Warnings", count: summary?.warnings ?? 0 },
              { value: "valid", label: "Valid", count: summary?.valid ?? 0 },
            ]}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by Org Code, UACS Code, Description…"
            label="Search GAA rows"
            className="pb-2 lg:w-96"
          />
        </div>
        <DataTable
          dense
          columns={columns}
          rows={paging.pageItems}
          rowKey={(r) => String(r.rowNo)}
          loading={loading}
          rowClassName={(r) => {
            const s = rowStatus(r);
            return s === "error" ? "bg-red-50/70" : s === "warning" ? "bg-amber-50/70" : undefined;
          }}
          emptyTitle={filter === "error" ? "No errors found" : filter === "warning" ? "No warnings" : "No rows match"}
          caption="GAA validation results"
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-gray-900">Validation Summary</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2 md:divide-x md:divide-gray-100">
            <IssueList title="Top Errors" tone="red" items={summary?.topErrors} empty="No errors found." />
            <div className="md:pl-6">
              <IssueList title="Top Warnings" tone="amber" items={summary?.topWarnings} empty="No warnings found." />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" size="lg" onClick={() => dispatch(stepChanged("upload"))}>
              <ChevronLeft className="size-4" /> Back to Upload
            </Button>
            <Button variant="outline" size="lg" onClick={downloadErrors} disabled={!summary || summary.errors + summary.warnings === 0}>
              <Download className="size-4" /> Download Error Report
            </Button>
            <Button
              size="lg"
              onClick={() => dispatch(stepChanged("map"))}
              disabled={loading || !summary || summary.valid + summary.warnings === 0}
            >
              <ChevronRight className="size-4" /> Proceed to Mapping
            </Button>
          </div>
          {summary && summary.errors > 0 && (
            <p className="mt-4 text-xs text-gray-500">
              Rows with errors can be skipped during import (see Import Settings in the next step).
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function IssueList({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: "red" | "amber";
  items?: GaaIssueCount[];
  empty: string;
}) {
  const Icon = tone === "red" ? XCircle : AlertTriangle;
  return (
    <div className="flex gap-3">
      <Icon className={tone === "red" ? "size-7 shrink-0 fill-red-600 text-white" : "size-7 shrink-0 fill-amber-400 text-white"} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={tone === "red" ? "font-semibold text-red-600" : "font-semibold text-amber-600"}>{title}</p>
        {items?.length ? (
          <ol className="mt-1.5 space-y-1.5 text-sm text-gray-700">
            {items.map((item, i) => (
              <li key={item.message} className="flex items-center justify-between gap-3">
                <span>
                  {i + 1}. {item.message}
                </span>
                <span
                  className={
                    tone === "red"
                      ? "rounded-md bg-red-100 px-2 text-xs font-semibold text-red-700"
                      : "rounded-md bg-amber-100 px-2 text-xs font-semibold text-amber-800"
                  }
                >
                  {item.count}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1.5 text-sm text-gray-500">{empty}</p>
        )}
      </div>
    </div>
  );
}
