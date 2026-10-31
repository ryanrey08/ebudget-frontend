"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChartColumnBig,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Download,
  Eye,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  Settings,
  Trash2,
  Wallet,
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
import { AllotmentClassBadge } from "@/components/shared/AllotmentClassBadge";
import { StatCard } from "@/components/shared/StatCard";
import { FISCAL_YEARS, type FiscalYear } from "@/config/site";
import { useAppDispatch } from "@/store/hooks";
import { fiscalYearChanged } from "@/store/slices/filtersSlice";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import { ALLOTMENT_CLASS_OPTIONS } from "@/lib/constants/options";
import { ROUTES } from "@/lib/constants/routes";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatCurrency, formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetAppropriationLookupsQuery } from "@/features/appropriations/services/appropriationsApi";
import {
  allotmentsApi,
  useDeleteAllotmentMutation,
  useGetAllotmentSummaryQuery,
  useGetAllotmentsQuery,
} from "../services/allotmentsApi";
import type { Allotment, AllotmentStatusGroup } from "../types";
import { AllotmentCharts } from "./AllotmentCharts";
import { AllotmentStatusBadge } from "./AllotmentStatusBadge";
import { allotmentHref } from "../workflow";

type OptionalColumn = "appropriation" | "org" | "program" | "tranche";
const OPTIONAL_COLUMNS: { key: OptionalColumn; label: string }[] = [
  { key: "appropriation", label: "Appropriation No." },
  { key: "org", label: "Org Code" },
  { key: "program", label: "Program/Activity" },
  { key: "tranche", label: "Tranche" },
];

const GROUP_TABS: { value: AllotmentStatusGroup | ""; label: string }[] = [
  { value: "", label: "All Allotments" },
  { value: "released", label: "Released" },
  { value: "partial", label: "Partial" },
  { value: "unreleased", label: "Unreleased" },
  { value: "approval", label: "For Approval" },
  { value: "draft", label: "Drafts & Returned" },
];

export function AllotmentsView() {
  const dispatch = useAppDispatch();
  const fiscalYear = useFiscalYear();
  const notify = useNotify();
  const [fundSource, setFundSource] = useState("");
  const [program, setProgram] = useState("");
  const [allotmentClass, setAllotmentClass] = useState<AllotmentClassCode | "">("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<AllotmentStatusGroup | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hidden, setHidden] = useState<Set<OptionalColumn>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);

  const params = { fiscalYear, fundSource, program, allotmentClass, group, search, page, pageSize };
  const list = useGetAllotmentsQuery(params);
  const summary = useGetAllotmentSummaryQuery({ fiscalYear });
  const lookups = useGetAppropriationLookupsQuery();
  const [fetchAll, { isFetching: exporting }] = allotmentsApi.endpoints.getAllotments.useLazyQuery();
  const [deleteAllotment] = useDeleteAllotmentMutation();
  const s = summary.data;
  const summaryLoading = summary.isLoading || summary.isFetching;
  const resetPage = () => setPage(1);

  const onDelete = async (a: Allotment) => {
    if (!window.confirm(`Delete ${a.allotmentNo}?`)) return;
    try {
      notify("success", "Allotment deleted", (await deleteAllotment(a.id).unwrap()).message);
    } catch (err) {
      notify("error", "Unable to delete", getErrorMessage(err));
    }
  };

  const onExport = async () => {
    try {
      const all = await fetchAll({ ...params, page: 1, pageSize: 100 }).unwrap();
      downloadCsv(
        `ebudget-allotments-fy${fiscalYear}`,
        toCsv(
          ["Allotment No.", "Appropriation No.", "Org Code", "Program/Activity", "Allotment Class", "Tranche", "Allotment Amount", "Released Amount", "Balance", "Status"],
          all.items.map((a) => [a.allotmentNo, a.appropriationRef, a.orgCode, a.program, a.allotmentClass, a.tranche, a.amount, a.released, a.amount - a.released, a.status]),
        ),
      );
    } catch (err) {
      notify("error", "Export failed", getErrorMessage(err));
    }
  };

  const offset = list.data ? (list.data.page - 1) * list.data.pageSize : 0;
  const columns = useMemo<Column<Allotment>[]>(() => {
    const all: (Column<Allotment> & { optional?: OptionalColumn })[] = [
      { key: "no", header: "#", cell: (a) => (list.data?.items.indexOf(a) ?? 0) + 1 + offset },
      {
        key: "allotmentNo",
        header: "Allotment No.",
        cell: (a) => (
          <Link href={allotmentHref(a)} className="font-medium whitespace-nowrap text-blue-700 hover:underline">
            {a.allotmentNo}
          </Link>
        ),
      },
      { key: "appropriation", optional: "appropriation", header: "Appropriation No.", hideBelow: "wide", cell: (a) => <span className="whitespace-nowrap">{a.appropriationRef}</span> },
      { key: "org", optional: "org", header: "Org Code", hideBelow: "wide", cell: (a) => <span className="whitespace-nowrap">{a.orgCode}</span> },
      { key: "program", optional: "program", header: "Program/Activity", hideBelow: "xl", className: "min-w-40", cell: (a) => a.program },
      { key: "class", header: "Allotment Class", cell: (a) => <AllotmentClassBadge code={a.allotmentClass} /> },
      { key: "tranche", optional: "tranche", header: "Tranche", hideBelow: "md", cell: (a) => <span className="whitespace-nowrap">{a.tranche}</span> },
      { key: "amount", header: "Allotment Amount", align: "right", cell: (a) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(a.amount)}</span> },
      { key: "released", header: "Released Amount", align: "right", hideBelow: "md", cell: (a) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(a.released)}</span> },
      { key: "balance", header: "Balance", align: "right", hideBelow: "lg", cell: (a) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(a.amount - a.released)}</span> },
      { key: "status", header: "Status", align: "center", cell: (a) => <AllotmentStatusBadge status={a.status} /> },
      {
        key: "actions",
        header: "Actions",
        align: "center",
        cell: (a) => (
          <DropdownMenu
            label={`Actions for ${a.allotmentNo}`}
            triggerClassName="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
            trigger={<MoreHorizontal className="size-4" />}
            items={[
              { label: a.status === "For Approval" || a.status === "Unreleased" ? "Open approval" : "View details", icon: Eye, href: allotmentHref(a) },
              { label: "Delete", icon: Trash2, danger: true, disabled: a.status !== "Draft" && a.status !== "Returned", onSelect: () => onDelete(a) },
            ]}
          />
        ),
      },
    ];
    return all.filter((c) => !c.optional || !hidden.has(c.optional));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, list.data, offset]);

  const clearAll = () => {
    setFundSource("");
    setProgram("");
    setAllotmentClass("");
    setSearchDraft("");
    setSearch("");
    setGroup("");
    resetPage();
  };

  return (
    <>
      <PageHeader
        title="Allotments"
        description="Manage budget allotments and tranche releases based on approved appropriations."
        actions={
          <DropdownMenu
            label="New Allotment"
            triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            trigger={
              <>
                <Plus className="size-4" /> New Allotment <ChevronDown className="size-4" />
              </>
            }
            items={[
              { label: "Create allotment", icon: FilePlus2, href: ROUTES.newAllotment },
              {
                label: "View pending approvals",
                icon: Clock3,
                onSelect: () => {
                  setGroup("approval");
                  resetPage();
                },
              },
            ]}
          />
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Total Allotments" value={formatCurrency(s?.totalAllotments ?? 0)} caption={`${formatPercent(safeRatio(s?.totalAllotments ?? 0, s?.appropriationTotal ?? 0))} of Appropriations`} icon={Database} iconTone="red" loading={summaryLoading} />
        <StatCard label="Released Allotments" value={formatCurrency(s?.totalReleased ?? 0)} caption={`${formatPercent(safeRatio(s?.totalReleased ?? 0, s?.totalAllotments ?? 0))} of Total Allotments`} icon={Wallet} iconTone="blue" loading={summaryLoading} />
        <StatCard label="Unreleased Allotments" value={formatCurrency(s?.unreleased ?? 0)} caption={`${formatPercent(safeRatio(s?.unreleased ?? 0, s?.totalAllotments ?? 0))} of Total Allotments`} icon={Clock3} iconTone="green" loading={summaryLoading} />
        <StatCard label="Number of Allotments" value={formatNumber(s?.count ?? 0)} caption="All Programs/Activities" icon={FileText} iconTone="dark" loading={summaryLoading} />
      </div>

      <Card className="mb-5 p-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,11rem))_minmax(0,1fr)_auto_auto] xl:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchDraft.trim());
            resetPage();
          }}
        >
          <Filter id="flt-fy" label="Fiscal Year" value={String(fiscalYear)} placeholder={undefined} onChange={(v) => dispatch(fiscalYearChanged(Number(v) as FiscalYear))} options={FISCAL_YEARS.map((fy) => ({ value: String(fy), label: String(fy) }))} />
          <Filter id="flt-fund" label="Fund Source" value={fundSource} onChange={(v) => { setFundSource(v); resetPage(); }} options={lookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []} />
          <Filter id="flt-program" label="Program/Activity" value={program} onChange={(v) => { setProgram(v); resetPage(); }} options={lookups.data?.programs.map((p) => ({ value: p, label: p })) ?? []} />
          <Filter id="flt-class" label="Allotment Class" value={allotmentClass} onChange={(v) => { setAllotmentClass(v as AllotmentClassCode | ""); resetPage(); }} options={ALLOTMENT_CLASS_OPTIONS} />
          <div className="sm:col-span-2 lg:col-span-4 xl:col-span-1">
            <label htmlFor="allotment-search" className="sr-only">Search allotments</label>
            <Input id="allotment-search" type="search" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search by Allotment No., Org Code, Description…" leftIcon={<Search className="size-4" />} />
          </div>
          <Button type="submit"><Search className="size-4" /> Search</Button>
          <Button variant="outline" onClick={clearAll}>Clear</Button>
        </form>
      </Card>

      <div className="mb-5">
        <AllotmentCharts summary={s} loading={summaryLoading} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 px-5 pt-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            label="Allotment status"
            className="border-b-0"
            value={group}
            onChange={(v) => { setGroup(v); resetPage(); }}
            items={GROUP_TABS.map((t) => ({ value: t.value, label: `${t.label} (${t.value ? s?.byGroup[t.value] ?? 0 : s?.count ?? 0})` }))}
          />
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <DropdownMenu
              label="Export"
              triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              trigger={<><Download className="size-4" /> {exporting ? "Exporting…" : "Export"} <ChevronDown className="size-4" /></>}
              items={[
                { label: "Export to CSV", icon: Download, onSelect: onExport },
                { label: "Print", icon: Printer, onSelect: () => window.print() },
              ]}
            />
            <Link href={ROUTES.bfars("bfars-4")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50" title="BFARS 4 – List of Allotments and Sub-Allotments">
              <ChartColumnBig className="size-4" /> Generate Report
            </Link>
            <div className="relative">
              <Button variant="outline" size="icon" aria-label="Table settings" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((v) => !v)}>
                <Settings className="size-4" />
              </Button>
              {columnsOpen && (
                <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">Show columns</p>
                  {OPTIONAL_COLUMNS.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 py-1 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={!hidden.has(c.key)}
                        onChange={() =>
                          setHidden((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.key)) next.delete(c.key);
                            else next.add(c.key);
                            return next;
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                  <button type="button" onClick={() => setColumnsOpen(false)} className="mt-2 text-xs font-medium text-blue-600 hover:underline">Done</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100">
          <DataTable
            dense
            columns={columns}
            rows={list.data?.items}
            rowKey={(a) => a.id}
            loading={list.isLoading || list.isFetching}
            error={list.error}
            onRetry={list.refetch}
            emptyTitle="No allotments found"
            emptyDescription="Adjust the filters or create a new allotment."
            caption="Allotments"
          />
        </div>
        {list.data && list.data.total > 0 && (
          <div className="border-t border-gray-100">
            <Pagination
              page={list.data.page}
              pageSize={list.data.pageSize}
              total={list.data.total}
              onPageChange={setPage}
              pageSizeOptions={[10, 25, 50]}
              onPageSizeChange={(n) => { setPageSize(n); resetPage(); }}
            />
          </div>
        )}
      </Card>
      {s && s.byGroup.approval > 0 && group !== "approval" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <CheckCircle2 className="size-4 text-purple-600" aria-hidden /> {s.byGroup.approval} allotment(s) are waiting for approval.
          <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => { setGroup("approval"); resetPage(); }}>Show them</button>
        </p>
      )}
    </>
  );
}

function Filter({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "All",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} options={options} />
    </div>
  );
}
