"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileStack,
  Hourglass,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import { ALLOTMENT_CLASS_OPTIONS, toOptions } from "@/lib/constants/options";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatCurrency, formatDate, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetAppropriationLookupsQuery } from "@/features/appropriations/services/appropriationsApi";
import {
  obligationsApi,
  useDeleteObligationMutation,
  useGetObligationSummaryQuery,
  useGetObligationsQuery,
} from "../services/obligationsApi";
import { OBLIGATION_STATUSES, type Obligation, type ObligationStatus, type ObligationTab } from "../types";
import { canEditObligation } from "../workflow";
import { ObligationCharts } from "./ObligationCharts";
import { ObligationStatusBadge } from "./ObligationStatusBadge";

const TABS: { value: ObligationTab | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "approval", label: "For Approval" },
  { value: "approved", label: "Approved" },
  { value: "released", label: "Released" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Drafts & Returned" },
];

export function ObligationManagementView() {
  const fiscalYear = useFiscalYear();
  const notify = useNotify();
  const [tab, setTab] = useState<ObligationTab | "">("");
  const [allotmentClass, setAllotmentClass] = useState<AllotmentClassCode | "">("");
  const [fundSource, setFundSource] = useState("");
  const [status, setStatus] = useState<ObligationStatus | "">("");
  const [dateFrom, setDateFrom] = useState(`${fiscalYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${fiscalYear}-12-31`);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Keep the date range inside the selected fiscal year.
  const [rangeYear, setRangeYear] = useState(fiscalYear);
  if (rangeYear !== fiscalYear) {
    setRangeYear(fiscalYear);
    setDateFrom(`${fiscalYear}-01-01`);
    setDateTo(`${fiscalYear}-12-31`);
  }

  const params = { fiscalYear, tab, allotmentClass, fundSource, status, dateFrom, dateTo, search, page, pageSize: 10 };
  const list = useGetObligationsQuery(params);
  const summary = useGetObligationSummaryQuery({ fiscalYear });
  const lookups = useGetAppropriationLookupsQuery();
  const [fetchAll, { isFetching: exporting }] = obligationsApi.endpoints.getObligations.useLazyQuery();
  const [deleteObligation] = useDeleteObligationMutation();
  const s = summary.data;
  const summaryLoading = summary.isLoading || summary.isFetching;
  const resetPage = () => setPage(1);

  const reset = () => {
    setTab("");
    setAllotmentClass("");
    setFundSource("");
    setStatus("");
    setDateFrom(`${fiscalYear}-01-01`);
    setDateTo(`${fiscalYear}-12-31`);
    setSearchDraft("");
    setSearch("");
    setSelected(new Set());
    resetPage();
  };

  const onDelete = async (o: Obligation) => {
    if (!window.confirm(`Delete ${o.referenceNo}?`)) return;
    try {
      notify("success", "Obligation deleted", (await deleteObligation(o.id).unwrap()).message);
    } catch (err) {
      notify("error", "Unable to delete", getErrorMessage(err));
    }
  };

  const exportRows = async (onlySelected: boolean) => {
    try {
      const all = await fetchAll({ ...params, page: 1, pageSize: 100 }).unwrap();
      const rows = onlySelected ? all.items.filter((o) => selected.has(o.id)) : all.items;
      downloadCsv(
        `ebudget-obligations-fy${fiscalYear}`,
        toCsv(
          ["Ref. No.", "Date", "Allotment No.", "Allotment Class", "Payee", "Particulars", "Obligation Amount", "Status"],
          rows.map((o) => [o.referenceNo, o.date.slice(0, 10), o.allotmentRef, o.allotmentClass, o.payee, o.particulars, o.amount, o.status]),
        ),
      );
    } catch (err) {
      notify("error", "Export failed", getErrorMessage(err));
    }
  };

  const items = list.data?.items;
  const allOnPage = !!items?.length && items.every((o) => selected.has(o.id));
  const columns = useMemo<Column<Obligation>[]>(
    () => [
      {
        key: "select",
        header: (
          <input
            type="checkbox"
            aria-label="Select all on this page"
            className="size-4 accent-brand-600"
            checked={allOnPage}
            onChange={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                items?.forEach((o) => (allOnPage ? next.delete(o.id) : next.add(o.id)));
                return next;
              })
            }
          />
        ),
        cell: (o) => (
          <input
            type="checkbox"
            aria-label={`Select ${o.referenceNo}`}
            className="size-4 accent-brand-600"
            checked={selected.has(o.id)}
            onChange={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(o.id)) next.delete(o.id);
                else next.add(o.id);
                return next;
              })
            }
          />
        ),
      },
      {
        key: "ref",
        header: "Ref. No.",
        cell: (o) => (
          <Link href={ROUTES.obligation(o.id)} className="whitespace-nowrap text-blue-700 underline-offset-2 hover:underline">
            {o.referenceNo}
          </Link>
        ),
      },
      { key: "date", header: "Date", hideBelow: "md", cell: (o) => <span className="whitespace-nowrap">{formatDate(o.date)}</span> },
      { key: "allotment", header: "Allotment No.", hideBelow: "lg", cell: (o) => <span className="whitespace-nowrap">{o.allotmentRef}</span> },
      { key: "class", header: "Allotment Class", hideBelow: "xl", cell: (o) => o.allotmentClass },
      { key: "particulars", header: "Particulars / Description", className: "min-w-52", cell: (o) => <span>{o.particulars}<span className="block text-xs text-gray-500">{o.payee}</span></span> },
      { key: "amount", header: "Obligation Amount", align: "right", cell: (o) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(o.amount)}</span> },
      { key: "status", header: "Status", align: "center", cell: (o) => <ObligationStatusBadge status={o.status} /> },
      {
        key: "actions",
        header: "Actions",
        align: "center",
        cell: (o) => (
          <span className="flex items-center justify-center gap-1">
            <Link href={ROUTES.obligation(o.id)} className="rounded p-1.5 text-gray-700 hover:bg-gray-100" aria-label={`View ${o.referenceNo}`}>
              <Eye className="size-4" />
            </Link>
            {canEditObligation(o) ? (
              <Link href={ROUTES.editObligation(o.id)} className="rounded p-1.5 text-gray-700 hover:bg-gray-100" aria-label={`Edit ${o.referenceNo}`}>
                <Pencil className="size-4" />
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded p-1.5 text-gray-300" title="Only drafts or returned obligations can be edited">
                <Pencil className="size-4" aria-hidden />
              </span>
            )}
            <DropdownMenu
              label={`More actions for ${o.referenceNo}`}
              triggerClassName="rounded p-1.5 text-gray-700 hover:bg-gray-100"
              trigger={<MoreHorizontal className="size-4" />}
              items={[
                { label: o.status === "For Approval" || o.status === "Approved" ? "Open approval" : "View details", icon: Eye, href: ROUTES.obligation(o.id) },
                { label: "Delete", icon: Trash2, danger: true, disabled: !canEditObligation(o), onSelect: () => onDelete(o) },
              ]}
            />
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, selected, allOnPage],
  );

  return (
    <>
      <PageHeader title="Obligation Management" description="Monitor, encode and manage obligations against approved allotments." />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Total Obligations" value={formatCurrency(s?.totalObligations ?? 0)} caption={`${formatPercent(safeRatio(s?.totalObligations ?? 0, s?.allotmentTotal ?? 0))} of Allotments`} icon={ClipboardList} iconTone="red" progress={{ value: safeRatio(s?.totalObligations ?? 0, s?.allotmentTotal ?? 0), tone: "red" }} loading={summaryLoading} />
        <StatCard label="Obligated Amount" value={formatCurrency(s?.obligatedAmount ?? 0)} caption={`${formatPercent(safeRatio(s?.obligatedAmount ?? 0, s?.totalObligations ?? 0), 1)} of Total Obligations`} icon={CheckCircle2} iconTone="green" progress={{ value: safeRatio(s?.obligatedAmount ?? 0, s?.totalObligations ?? 0), tone: "green" }} loading={summaryLoading} />
        <StatCard label="Pending Approval" value={formatCurrency(s?.pendingApproval ?? 0)} caption={`${formatPercent(safeRatio(s?.pendingApproval ?? 0, s?.totalObligations ?? 0), 1)} of Total Obligations`} icon={Hourglass} iconTone="amber" progress={{ value: safeRatio(s?.pendingApproval ?? 0, s?.totalObligations ?? 0), tone: "amber" }} loading={summaryLoading} />
        <StatCard label="Released / Disbursed" value={formatCurrency(s?.releasedAmount ?? 0)} caption={`${formatPercent(safeRatio(s?.releasedAmount ?? 0, s?.totalObligations ?? 0), 1)} of Total Obligations`} icon={FileStack} iconTone="blue" progress={{ value: safeRatio(s?.releasedAmount ?? 0, s?.totalObligations ?? 0), tone: "blue" }} loading={summaryLoading} />
      </div>

      <div className="mb-5">
        <ObligationCharts summary={s} loading={summaryLoading} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Obligation List</h2>
            <Tabs
              label="Obligation status"
              className="mt-1 border-b-0"
              value={tab}
              onChange={(v) => { setTab(v); resetPage(); }}
              items={TABS.map((t) => ({ value: t.value, label: t.label, count: t.value ? s?.byTab[t.value] : s?.count }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={ROUTES.newObligation} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              <Plus className="size-4" /> New Obligation
            </Link>
            <Link href={`${ROUTES.newObligation}?import=pr`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Upload className="size-4" /> Import from PR/PO
            </Link>
          </div>
        </div>

        <form
          className="space-y-3 border-y border-gray-100 px-5 py-4"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchDraft.trim()); resetPage(); }}
        >
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto] xl:items-center">
            <Select aria-label="Allotment class" value={allotmentClass} placeholder="All Allotment Classes" options={ALLOTMENT_CLASS_OPTIONS} onChange={(e) => { setAllotmentClass(e.target.value as AllotmentClassCode | ""); resetPage(); }} />
            <Select aria-label="Fund source" value={fundSource} placeholder="All Fund Sources" options={lookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []} onChange={(e) => { setFundSource(e.target.value); resetPage(); }} />
            <Select aria-label="Status" value={status} placeholder="All Status" options={toOptions(OBLIGATION_STATUSES)} onChange={(e) => { setStatus(e.target.value as ObligationStatus | ""); resetPage(); }} />
            <div className="flex items-center gap-1.5 sm:col-span-3 xl:col-span-1">
              <label className="sr-only" htmlFor="date-from">From</label>
              <Input id="date-from" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage(); }} className="h-10 w-[9.5rem]" />
              <span className="text-gray-400">–</span>
              <label className="sr-only" htmlFor="date-to">To</label>
              <Input id="date-to" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage(); }} className="h-10 w-[9.5rem]" />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="obligation-search" className="sr-only">Search obligations</label>
              <Input id="obligation-search" type="search" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search reference no., description, payee…" leftIcon={<Search className="size-4" />} />
            </div>
            <div className="flex gap-3">
              <Button type="submit"><Search className="size-4" /> Search</Button>
              <Button variant="outline" onClick={reset}>Reset</Button>
            </div>
          </div>
        </form>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-blue-50 px-5 py-2.5 text-sm text-blue-900">
            {selected.size} selected
            <Button size="sm" variant="outline" onClick={() => exportRows(true)} loading={exporting}><Download className="size-4" /> Export selected</Button>
            <button type="button" className="text-xs font-medium hover:underline" onClick={() => setSelected(new Set())}>Clear selection</button>
          </div>
        )}

        <DataTable
          dense
          columns={columns}
          rows={items}
          rowKey={(o) => o.id}
          loading={list.isLoading || list.isFetching}
          error={list.error}
          onRetry={list.refetch}
          rowClassName={(o) => cn(selected.has(o.id) && "bg-blue-50/50")}
          emptyTitle="No obligations found"
          emptyDescription="Adjust the filters or create a new obligation."
          caption="Obligations"
        />
        {list.data && list.data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between border-t border-gray-100">
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} />
            <div className="px-5 pb-3 sm:pb-0">
              <Button variant="outline" size="sm" onClick={() => exportRows(false)} loading={exporting}><Download className="size-4" /> Export CSV</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
