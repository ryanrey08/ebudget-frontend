"use client";

import { useState } from "react";
import { CircleDollarSign, ClipboardCheck, Download, HandCoins, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { SearchInput } from "@/components/shared/SearchInput";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import type { AllotmentClassMeta } from "@/lib/constants/allotment-classes";
import { ROUTES } from "@/lib/constants/routes";
import { toOptions } from "@/lib/constants/options";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatCurrency, formatDate, formatPercent, safeRatio } from "@/lib/utils/format";
import { OBLIGATION_STATUSES, type ObligationStatus } from "@/features/obligation-management/types";
import { useGetAllotmentClassRegistryQuery } from "../services/allotmentClassesApi";
import type { RegistryEntry } from "../types";

export const registryEntryColumns: Column<RegistryEntry>[] = [
  { key: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap">{formatDate(e.date)}</span> },
  { key: "ref", header: "Obligation No.", cell: (e) => <span className="font-medium whitespace-nowrap text-gray-900">{e.obligationRef}</span> },
  { key: "allotment", header: "Allotment No.", cell: (e) => <span className="whitespace-nowrap">{e.allotmentNo}</span>, hideBelow: "md" },
  { key: "uacs", header: "UACS", cell: (e) => <span className="font-mono text-xs">{e.uacsCode}</span>, hideBelow: "xl" },
  { key: "payee", header: "Payee / Particulars", className: "min-w-52", cell: (e) => <span>{e.payee}<span className="block text-xs text-gray-500">{e.particulars}</span></span> },
  { key: "obligation", header: "Obligation", align: "right", cell: (e) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(e.obligation)}</span> },
  { key: "disbursement", header: "Disbursement", align: "right", hideBelow: "lg", cell: (e) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(e.disbursement)}</span> },
  { key: "unpaid", header: "Unpaid", align: "right", hideBelow: "lg", cell: (e) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(e.obligation - e.disbursement)}</span> },
  { key: "status", header: "Status", align: "center", cell: (e) => <StatusBadge status={e.status} /> },
];

export function AllotmentClassView({ meta }: { meta: AllotmentClassMeta }) {
  const fiscalYear = useFiscalYear();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ObligationStatus | "">("");
  const { data, isLoading, isFetching, error, refetch } = useGetAllotmentClassRegistryQuery({ code: meta.code, fiscalYear });
  const loading = isLoading || isFetching;
  const s = data?.summary;

  const entries = data?.entries
    .filter((e) => !status || e.status === status)
    .filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return [e.obligationRef, e.allotmentNo, e.payee, e.particulars].some((f) => f.toLowerCase().includes(q));
    });

  const exportRows = () =>
    downloadCsv(
      `ebudget-${meta.code.toLowerCase()}-fy${fiscalYear}`,
      toCsv(
        ["Date", "Obligation No.", "Allotment No.", "UACS", "Payee", "Particulars", "Obligation", "Disbursement", "Status"],
        (entries ?? []).map((e) => [e.date.slice(0, 10), e.obligationRef, e.allotmentNo, e.uacsCode, e.payee, e.particulars, e.obligation, e.disbursement, e.status]),
      ),
    );

  return (
    <>
      <PageHeader
        title={meta.code}
        description={`${meta.name} · FY ${fiscalYear}`}
        actions={
          <>
            <Button variant="outline" onClick={exportRows} disabled={!entries?.length}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Link
              href={`${ROUTES.obligationManagement}?new=1`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="size-4" /> New Obligation
            </Link>
          </>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Allotments" value={formatCurrency(s?.allotments ?? 0)} caption={meta.expenseClass} icon={Wallet} iconTone="red" loading={loading} />
        <StatCard
          label="Obligations"
          value={formatCurrency(s?.obligations ?? 0)}
          caption={`${formatPercent(safeRatio(s?.obligations ?? 0, s?.allotments ?? 0))} of allotments`}
          icon={ClipboardCheck}
          iconTone="dark"
          progress={{ value: safeRatio(s?.obligations ?? 0, s?.allotments ?? 0), tone: "green" }}
          loading={loading}
        />
        <StatCard
          label="Disbursements"
          value={formatCurrency(s?.disbursements ?? 0)}
          caption={`${formatPercent(safeRatio(s?.disbursements ?? 0, s?.obligations ?? 0))} of obligations`}
          icon={HandCoins}
          iconTone="red"
          progress={{ value: safeRatio(s?.disbursements ?? 0, s?.obligations ?? 0), tone: "blue" }}
          loading={loading}
        />
        <StatCard
          label="Unobligated Balance"
          value={formatCurrency(s?.unobligatedBalance ?? 0)}
          caption={`${formatPercent(safeRatio(s?.unobligatedBalance ?? 0, s?.allotments ?? 0))} of allotments`}
          icon={CircleDollarSign}
          iconTone="dark"
          progress={{ value: safeRatio(s?.unobligatedBalance ?? 0, s?.allotments ?? 0), tone: "amber" }}
          loading={loading}
        />
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Monthly Obligations and Disbursements" />
          <CardBody>
            {loading || !data ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <AreaTrendChart
                data={data.monthly}
                categoryKey="month"
                series={[
                  { key: "obligations", label: "Obligations", color: meta.color },
                  { key: "disbursements", label: "Disbursements", color: "#1f2937" },
                ]}
              />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Allotments in this Class" description="Obligated against each allotment" />
          <CardBody className="space-y-4">
            {loading || !data
              ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)
              : data.allotments.map((a) => (
                  <div key={a.allotmentNo}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium text-gray-900">{a.allotmentNo}</span>
                        <span className="block truncate text-xs text-gray-500">{a.objectOfExpenditure}</span>
                      </span>
                      <span className="text-right text-xs whitespace-nowrap text-gray-600 tabular-nums">
                        {formatCurrency(a.obligated)}
                        <span className="block text-gray-400">of {formatCurrency(a.amount)}</span>
                      </span>
                    </div>
                    <ProgressBar value={safeRatio(a.obligated, a.amount)} tone="green" label={`${a.allotmentNo} utilization`} />
                  </div>
                ))}
            {data && data.allotments.length === 0 && <p className="text-sm text-gray-500">No allotments for this class.</p>}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={`${meta.code} Registry`} description="Obligations recorded against this allotment class" className="pb-2" />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search obligation, allotment or payee" label={`Search ${meta.code}`} />
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ObligationStatus | "")}
            placeholder="All statuses"
            options={toOptions(OBLIGATION_STATUSES)}
          />
        </FilterBar>
        <DataTable
          columns={registryEntryColumns}
          rows={entries}
          rowKey={(e) => e.id}
          loading={loading}
          error={error}
          onRetry={refetch}
          caption={`${meta.code} registry`}
        />
      </Card>
    </>
  );
}
