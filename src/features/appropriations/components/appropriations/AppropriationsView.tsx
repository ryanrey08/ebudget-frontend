"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  CloudUpload,
  Database,
  Download,
  Eye,
  FilePlus2,
  FileText,
  MoreHorizontal,
  PieChart,
  Plus,
  Printer,
  Search,
  Settings,
  Trash2,
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
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import { ALLOTMENT_CLASS_OPTIONS } from "@/lib/constants/options";
import { ROUTES } from "@/lib/constants/routes";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatCurrency, formatNumber, formatPercent, safeRatio } from "@/lib/utils/format";
import {
  appropriationsApi,
  useDeleteAppropriationMutation,
  useGetAppropriationLookupsQuery,
  useGetAppropriationSummaryQuery,
  useGetAppropriationsQuery,
} from "../../services/appropriationsApi";
import { APPROPRIATION_CATEGORIES, type Appropriation, type AppropriationCategory } from "../../types";
import { AppropriationDetailModal } from "./AppropriationDetailModal";
import { AppropriationStatusBadge } from "./AppropriationStatusBadge";
import { AppropriationSummaryCharts } from "./AppropriationSummaryCharts";

type OptionalColumn = "org" | "office" | "fund" | "program";
const OPTIONAL_COLUMNS: { key: OptionalColumn; label: string }[] = [
  { key: "org", label: "Org Code" },
  { key: "office", label: "Organization/Office" },
  { key: "fund", label: "Fund Source" },
  { key: "program", label: "Program/Activity" },
];

export function AppropriationsView() {
  const fiscalYear = useFiscalYear();
  const notify = useNotify();
  const [fundSource, setFundSource] = useState("");
  const [program, setProgram] = useState("");
  const [allotmentClass, setAllotmentClass] = useState<AllotmentClassCode | "">("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AppropriationCategory | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hidden, setHidden] = useState<Set<OptionalColumn>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selected, setSelected] = useState<Appropriation | null>(null);

  const params = { fiscalYear, fundSource, program, allotmentClass, category, search, page, pageSize };
  const list = useGetAppropriationsQuery(params);
  const summary = useGetAppropriationSummaryQuery({ fiscalYear });
  const lookups = useGetAppropriationLookupsQuery();
  const [fetchAll, { isFetching: exporting }] = appropriationsApi.endpoints.getAppropriations.useLazyQuery();
  const [deleteAppropriation] = useDeleteAppropriationMutation();

  const fundName = (code: string) => lookups.data?.fundSources.find((f) => f.code === code)?.name ?? "";
  const s = summary.data;
  const summaryLoading = summary.isLoading || summary.isFetching;
  const resetPage = () => setPage(1);

  const onDelete = async (a: Appropriation) => {
    if (!window.confirm(`Delete ${a.referenceNo} – ${a.title}?`)) return;
    try {
      const res = await deleteAppropriation(a.id).unwrap();
      notify("success", "Appropriation deleted", res.message);
    } catch (err) {
      notify("error", "Unable to delete", getErrorMessage(err));
    }
  };

  const onExport = async () => {
    try {
      const all = await fetchAll({ ...params, page: 1, pageSize: 100 }).unwrap();
      downloadCsv(
        `ebudget-appropriations-fy${fiscalYear}`,
        toCsv(
          ["Reference No.", "Org Code", "Organization/Office", "UACS Code", "Description", "Appropriation Amount", "Fund Source", "Allotment Class", "Program/Activity", "Status"],
          all.items.map((a) => [a.referenceNo, a.orgCode, a.office, a.uacsCode, a.objectOfExpenditure, a.amount, a.fundSource, a.allotmentClass, a.program, a.status]),
        ),
      );
    } catch (err) {
      notify("error", "Export failed", getErrorMessage(err));
    }
  };

  const rowOffset = list.data ? (list.data.page - 1) * list.data.pageSize : 0;
  const columns = useMemo<Column<Appropriation>[]>(() => {
    const all: (Column<Appropriation> & { optional?: OptionalColumn })[] = [
      { key: "no", header: "#", cell: (a) => (list.data?.items.indexOf(a) ?? 0) + 1 + rowOffset },
      { key: "org", optional: "org", header: "Org Code", hideBelow: "xl", cell: (a) => <span className="whitespace-nowrap">{a.orgCode || "—"}</span> },
      { key: "office", optional: "office", header: "Organization/Office", hideBelow: "wide", cell: (a) => <span className="whitespace-nowrap">{a.office || "—"}</span> },
      { key: "uacs", header: "UACS Code", cell: (a) => <span className="tabular-nums">{a.uacsCode || "—"}</span> },
      {
        key: "desc",
        header: "Description",
        className: "min-w-48",
        cell: (a) => (
          <span>
            {a.objectOfExpenditure || a.title}
            {a.objectOfExpenditure && a.title !== a.objectOfExpenditure && (
              <span className="block text-xs text-gray-500">{a.title}</span>
            )}
          </span>
        ),
      },
      { key: "amount", header: "Appropriation Amount", align: "right", cell: (a) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(a.amount)}</span> },
      { key: "fund", optional: "fund", header: "Fund Source", hideBelow: "md", cell: (a) => a.fundSource || "—" },
      { key: "class", header: "Allotment Class", cell: (a) => <AllotmentClassBadge code={a.allotmentClass} /> },
      { key: "program", optional: "program", header: "Program/Activity", hideBelow: "lg", className: "min-w-40", cell: (a) => a.program || "—" },
      { key: "status", header: "Status", align: "center", cell: (a) => <AppropriationStatusBadge status={a.status} /> },
      {
        key: "actions",
        header: "Actions",
        align: "center",
        cell: (a) => (
          <DropdownMenu
            label={`Actions for ${a.referenceNo}`}
            triggerClassName="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
            trigger={<MoreHorizontal className="size-4" />}
            items={[
              { label: "View details", icon: Eye, onSelect: () => setSelected(a) },
              { label: "Create allotment", icon: FilePlus2, href: `${ROUTES.newAllotment}?appropriation=${a.referenceNo}`, disabled: a.status === "Draft" },
              { label: "Delete", icon: Trash2, danger: true, disabled: a.allotted > 0, onSelect: () => onDelete(a) },
            ]}
          />
        ),
      },
    ];
    return all.filter((c) => !c.optional || !hidden.has(c.optional));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, list.data, rowOffset]);

  const categoryCount = (c: AppropriationCategory) => s?.byCategory[c] ?? 0;

  return (
    <>
      <PageHeader
        title="Appropriations"
        description="Manage budget appropriations based on the General Appropriations Act (GAA)."
        actions={
          <DropdownMenu
            label="New Appropriation"
            triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            trigger={
              <>
                <Plus className="size-4" /> New Appropriation <ChevronDown className="size-4" />
              </>
            }
            items={[
              { label: "Create manually", icon: FilePlus2, href: ROUTES.newAppropriation },
              { label: "Import from GAA file", icon: CloudUpload, href: ROUTES.gaaUpload },
            ]}
          />
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Total Appropriations" value={formatCurrency(s?.totalAmount ?? 0)} caption={`FY ${fiscalYear} GAA`} icon={Database} iconTone="red" loading={summaryLoading} />
        <StatCard label="Number of Appropriations" value={formatNumber(s?.count ?? 0)} caption="Budget Items" icon={FileText} iconTone="dark" loading={summaryLoading} />
        <StatCard label="Released" value={formatCurrency(s?.released ?? 0)} caption={formatPercent(safeRatio(s?.released ?? 0, s?.totalAmount ?? 0))} icon={PieChart} iconTone="blue" loading={summaryLoading} />
        <StatCard label="Unreleased" value={formatCurrency(s?.unreleased ?? 0)} caption={formatPercent(safeRatio(s?.unreleased ?? 0, s?.totalAmount ?? 0))} icon={PieChart} iconTone="green" loading={summaryLoading} />
      </div>

      <Card className="mb-5 p-4">
        <form
          className="grid gap-3 md:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,13rem))_minmax(0,1fr)_auto_auto] xl:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchDraft.trim());
            resetPage();
          }}
        >
          <FilterSelect
            id="filter-fund"
            label="Fund Source"
            value={fundSource}
            onChange={(v) => {
              setFundSource(v);
              resetPage();
            }}
            options={lookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []}
          />
          <FilterSelect
            id="filter-program"
            label="Program/Activity"
            value={program}
            onChange={(v) => {
              setProgram(v);
              resetPage();
            }}
            options={lookups.data?.programs.map((p) => ({ value: p, label: p })) ?? []}
          />
          <FilterSelect
            id="filter-class"
            label="Allotment Class"
            value={allotmentClass}
            onChange={(v) => {
              setAllotmentClass(v as AllotmentClassCode | "");
              resetPage();
            }}
            options={ALLOTMENT_CLASS_OPTIONS}
          />
          <div className="md:col-span-2 xl:col-span-1">
            <label htmlFor="appropriation-search" className="sr-only">
              Search appropriations
            </label>
            <Input
              id="appropriation-search"
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search by Org Code, UACS Code or Description…"
              leftIcon={<Search className="size-4" />}
            />
          </div>
          <Button type="submit">
            <Search className="size-4" /> Search
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFundSource("");
              setProgram("");
              setAllotmentClass("");
              setSearchDraft("");
              setSearch("");
              setCategory("");
              resetPage();
            }}
          >
            Clear
          </Button>
        </form>
      </Card>

      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-3 px-5 pt-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            label="Appropriation category"
            className="border-b-0"
            value={category}
            onChange={(v) => {
              setCategory(v);
              resetPage();
            }}
            items={[
              { value: "" as const, label: `All Appropriations (${s?.count ?? 0})` },
              ...APPROPRIATION_CATEGORIES.map((c) => ({ value: c, label: `${c} (${categoryCount(c)})` })),
            ]}
          />
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Link
              href={ROUTES.gaaUpload}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <CloudUpload className="size-4" /> Upload GAA
            </Link>
            <DropdownMenu
              label="Export"
              triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              trigger={
                <>
                  <Download className="size-4" /> {exporting ? "Exporting…" : "Export"} <ChevronDown className="size-4" />
                </>
              }
              items={[
                { label: "Export to CSV", icon: Download, onSelect: onExport },
                { label: "Print", icon: Printer, onSelect: () => window.print() },
              ]}
            />
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
                  <button type="button" onClick={() => setColumnsOpen(false)} className="mt-2 text-xs font-medium text-blue-600 hover:underline">
                    Done
                  </button>
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
            emptyTitle="No appropriations found"
            emptyDescription="Adjust the filters or create a new appropriation."
            caption="Appropriations"
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
              onPageSizeChange={(n) => {
                setPageSize(n);
                resetPage();
              }}
            />
          </div>
        )}
      </Card>

      <AppropriationSummaryCharts summary={s} loading={summaryLoading} />
      <AppropriationDetailModal appropriation={selected} fundSourceName={fundName} onClose={() => setSelected(null)} />
    </>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="All" options={options} />
    </div>
  );
}
