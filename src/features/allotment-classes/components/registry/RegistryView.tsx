"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, CloudUpload, Download, Eye, FileBarChart, FileText, HandCoins, MoreHorizontal, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { FISCAL_YEARS, type FiscalYear } from "@/config/site";
import { useAppDispatch } from "@/store/hooks";
import { fiscalYearChanged } from "@/store/slices/filtersSlice";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import type { AllotmentClassMeta } from "@/lib/constants/allotment-classes";
import { BFARS_REPORTS } from "@/lib/constants/bfars";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";
import { useGetAppropriationLookupsQuery, useGetAppropriationSummaryQuery } from "@/features/appropriations/services/appropriationsApi";
import { useDeleteAllotmentMutation, useGetAllotmentsQuery, useGetRegistryLookupsQuery } from "@/features/allotments/services/allotmentsApi";
import { TRANCHE_TYPES, type Allotment } from "@/features/allotments/types";
import { allotmentHref } from "@/features/allotments/workflow";
import { useGetAllotmentClassRegistryQuery } from "../../services/allotmentClassesApi";
import { registryEntryColumns } from "../AllotmentClassView";
import { registryConfig } from "../../registryConfig";
import { RegistryCharts } from "./RegistryCharts";
import { RegistryOverviewCharts } from "./RegistryOverviewCharts";
import { RaofeCharts } from "./RaofeCharts";
import { RegistryUacsCharts } from "./RegistryUacsCharts";
import { RegistryStatusBadge, registryStatus } from "./RegistryStatusBadge";

type Tab = "overview" | "allotments" | "tranches" | "obligations" | "disbursements" | "balances" | "reports";
const TABS: { value: Tab; label: string }[] = [
  { value: "allotments", label: "Allotments" },
  { value: "obligations", label: "Obligations" },
  { value: "disbursements", label: "Disbursements" },
  { value: "balances", label: "Balances" },
  { value: "reports", label: "Reports" },
];
const OVERVIEW_TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "allotments", label: "Allotments" },
  { value: "obligations", label: "Obligations" },
  { value: "disbursements", label: "Disbursements" },
  { value: "reports", label: "Reports" },
];
const RAOFE_TABS: { value: Tab; label: string }[] = [
  { value: "allotments", label: "All RAOFE Allotments" },
  { value: "tranches", label: "Tranches" },
  { value: "obligations", label: "Obligations" },
  { value: "disbursements", label: "Disbursements" },
  { value: "reports", label: "Reports" },
];
const STATUS_FILTERS = ["Active", "Fully Utilized", "Unreleased", "For Approval", "Draft", "Returned", "Rejected"];
const counted = (a: Allotment) => a.status !== "Draft" && a.status !== "Rejected";

/** Status tabs for the RAOMO-style list (display grouping only). */
type StatusGroup = "" | "active" | "approval" | "obligated" | "disbursed" | "closed" | "draft";
function statusGroup(a: Allotment, disbursed: number): StatusGroup {
  if (a.status === "Draft" || a.status === "Returned") return "draft";
  if (a.status === "Rejected") return "closed";
  if (a.status === "For Approval" || a.status === "Unreleased") return "approval";
  if (a.obligated >= a.amount) return "closed";
  if (a.obligated > 0 && disbursed >= a.obligated) return "disbursed";
  if (a.obligated > 0) return "obligated";
  return "active";
}

/** Allotment-class page (RAOPS design): allotments, obligations, disbursements and balances for one class. */
export function RegistryView({ meta }: { meta: AllotmentClassMeta }) {
  const dispatch = useAppDispatch();
  const notify = useNotify();
  const fiscalYear = useFiscalYear();
  const [tab, setTab] = useState<Tab>(registryConfig(meta.slug).listVariant === "overview" ? "overview" : "allotments");
  const [department, setDepartment] = useState("");
  const [fundSource, setFundSource] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<StatusGroup>("");
  const config = registryConfig(meta.slug);
  const statusVariant = config.listVariant === "status";
  const overviewVariant = config.listVariant === "overview";
  const raofeVariant = config.listVariant === "raofe";
  const tabs = overviewVariant ? OVERVIEW_TABS : raofeVariant ? RAOFE_TABS : TABS;
  const showTable = tab === "allotments" || tab === "overview";

  const allotments = useGetAllotmentsQuery({ fiscalYear, allotmentClass: meta.code, pageSize: 100 });
  const allClasses = useGetAllotmentsQuery({ fiscalYear, pageSize: 100 }, { skip: !raofeVariant });
  const registry = useGetAllotmentClassRegistryQuery({ code: meta.code, fiscalYear });
  const appSummary = useGetAppropriationSummaryQuery({ fiscalYear });
  const lookups = useGetRegistryLookupsQuery(meta.code);
  const appLookups = useGetAppropriationLookupsQuery();
  const [deleteAllotment] = useDeleteAllotmentMutation();
  const loading = allotments.isLoading || registry.isLoading || allotments.isFetching;

  // Disbursements per allotment, from the obligations recorded in this class.
  const disbursedBy = useMemo(() => {
    const map = new Map<string, number>();
    registry.data?.entries
      .filter((e) => e.status !== "Cancelled" && e.status !== "Draft")
      .forEach((e) => map.set(e.allotmentNo, (map.get(e.allotmentNo) ?? 0) + e.disbursement));
    return map;
  }, [registry.data]);

  const all = useMemo(() => allotments.data?.items ?? [], [allotments.data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((a) => !department || a.department === department)
      .filter((a) => !fundSource || a.fundSource === fundSource)
      .filter((a) => !status || registryStatus(a) === status)
      .filter((a) => !group || statusGroup(a, disbursedBy.get(a.allotmentNo) ?? 0) === group)
      .filter((a) => !q || [a.allotmentNo, a.purpose, a.department ?? "", a.objectOfExpenditure].some((f) => f.toLowerCase().includes(q)))
      .sort((a, b) => a.allotmentNo.localeCompare(b.allotmentNo));
  }, [all, department, fundSource, status, search, group, disbursedBy]);
  const paging = useClientPagination(rows, 10);

  const valid = all.filter(counted);
  const totals = {
    allotments: valid.reduce((s, a) => s + a.amount, 0),
    obligations: valid.reduce((s, a) => s + a.obligated, 0),
    disbursements: valid.reduce((s, a) => s + (disbursedBy.get(a.allotmentNo) ?? 0), 0),
    balance: 0,
  };
  totals.balance = totals.allotments - totals.obligations;
  const allClassTotal = (allClasses.data?.items ?? []).filter(counted).reduce((s, a) => s + a.amount, 0);
  const classAppropriation = appSummary.data?.byClass.find((c) => c.allotmentClass === meta.code)?.amount ?? 0;
  const rowTotals = rows.filter(counted).reduce(
    (t, a) => ({ amount: t.amount + a.amount, obligations: t.obligations + a.obligated, disbursements: t.disbursements + (disbursedBy.get(a.allotmentNo) ?? 0) }),
    { amount: 0, obligations: 0, disbursements: 0 },
  );

  const byTranche = TRANCHE_TYPES.map((tranche) => {
    const inT = valid.filter((a) => a.tranche === tranche);
    return {
      tranche: tranche.replace(" Release", ""),
      allotment: inT.reduce((s, a) => s + a.amount, 0),
      obligations: inT.reduce((s, a) => s + a.obligated, 0),
      disbursements: inT.reduce((s, a) => s + (disbursedBy.get(a.allotmentNo) ?? 0), 0),
    };
  }).filter((t) => t.allotment > 0);
  const byDepartment = [...valid.reduce((m, a) => m.set(a.department ?? "—", (m.get(a.department ?? "—") ?? 0) + a.amount), new Map<string, number>())]
    .map(([department, amount]) => ({ department, amount }))
    .sort((a, b) => b.amount - a.amount);

  const onDelete = async (a: Allotment) => {
    if (!window.confirm(`Delete ${a.allotmentNo}?`)) return;
    try {
      notify("success", "Allotment deleted", (await deleteAllotment(a.id).unwrap()).message);
    } catch (err) {
      notify("error", "Unable to delete", getErrorMessage(err));
    }
  };

  const exportCsv = () =>
    downloadCsv(
      `ebudget-${meta.code.toLowerCase()}-fy${fiscalYear}`,
      toCsv(
        ["Allotment No.", "Tranche", "Department/Office", "Particulars", "Allotment Amount", "Obligations", "Disbursements", "Balance", "Status"],
        rows.map((a) => [a.allotmentNo, a.tranche, a.department ?? "", a.purpose, a.amount, a.obligated, disbursedBy.get(a.allotmentNo) ?? 0, a.amount - a.obligated, registryStatus(a)]),
      ),
    );

  const byUacs = [...valid.reduce((m, a) => {
    const key = a.uacsCode;
    const cur = m.get(key) ?? { uacs: key, label: a.objectOfExpenditure, amount: 0 };
    cur.amount += a.amount;
    return m.set(key, cur);
  }, new Map<string, { uacs: string; label: string; amount: number }>()).values()].sort((x, y) => y.amount - x.amount);

  const byAllotmentChart = valid
    .filter((a) => a.status === "Released" || a.status === "Partial")
    .sort((x, y) => y.amount - x.amount)
    .slice(0, 5)
    .map((a) => ({
      label: (a.purpose || a.objectOfExpenditure).slice(0, 22),
      allotment: a.amount,
      obligations: a.obligated,
      disbursements: disbursedBy.get(a.allotmentNo) ?? 0,
    }));
  const byExpenseType = [...valid.reduce((m, a) => {
    const key = a.objectOfExpenditure || a.purpose;
    const cur = m.get(key) ?? { label: key, allotment: 0, obligations: 0, disbursements: 0 };
    cur.allotment += a.amount;
    cur.obligations += a.obligated;
    cur.disbursements += disbursedBy.get(a.allotmentNo) ?? 0;
    return m.set(key, cur);
  }, new Map<string, { label: string; allotment: number; obligations: number; disbursements: number }>()).values()].sort((x, y) => y.allotment - x.allotment);
  const recent: RecentItem[] = [
    ...all.filter((a) => a.status !== "Draft").map((a) => ({
      id: a.id,
      date: a.date,
      type: "Allotment" as const,
      ref: a.allotmentNo,
      particulars: a.purpose || a.objectOfExpenditure,
      amount: a.amount,
      by: a.workflow[0]?.actorName ?? "—",
      status: registryStatus(a),
      href: allotmentHref(a),
    })),
    ...(registry.data?.entries ?? []).filter((e) => e.status !== "Draft").flatMap((e) => [
      { id: `${e.id}-o`, date: e.date, type: "Obligation" as const, ref: e.obligationRef, particulars: e.particulars, amount: e.obligation, by: e.payee, status: e.status, href: ROUTES.obligation(e.id) },
      ...(e.disbursement > 0
        ? [{ id: `${e.id}-d`, date: e.date, type: "Disbursement" as const, ref: e.obligationRef, particulars: `Payment – ${e.particulars}`, amount: e.disbursement, by: e.payee, status: "Released", href: ROUTES.obligation(e.id) }]
        : []),
    ]),
  ]
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, 5);

  const money = (v: number) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(v).replace("₱", "")}</span>;
  const allColumns: (Column<Allotment> & { only?: ("sections" | "status" | "overview" | "raofe")[] })[] = [
    { key: "no", header: "#", cell: (a) => rows.indexOf(a) + 1 },
    { key: "allotmentNo", header: "Allotment No.", cell: (a) => <Link href={allotmentHref(a)} className="whitespace-nowrap text-blue-700 underline-offset-2 hover:underline">{a.allotmentNo}</Link> },
    { key: "tranche", only: ["sections"], header: "Tranche", hideBelow: "wide", cell: (a) => <span className="whitespace-nowrap">{a.tranche}</span> },
    { key: "trancheShort", only: ["status"], header: "Tranche", hideBelow: "wide", cell: (a) => <span className="whitespace-nowrap">{a.tranche.replace(" Tranche", "").replace(" Release", "")}</span> },
    { key: "reference", only: ["overview"], header: "Reference (GAA)", hideBelow: "wide", cell: (a) => <span className="whitespace-nowrap">{a.gaaReferenceNo || a.appropriationRef}</span> },
    { key: "uacs", only: ["status", "overview", "raofe"], header: raofeVariant ? "Code" : "UACS Code", hideBelow: "md", cell: (a) => <span className="tabular-nums">{a.uacsCode}</span> },
    { key: "dept", only: ["sections"], header: "Department/Office", hideBelow: "md", cell: (a) => a.department ?? "—" },
    { key: "particulars", header: raofeVariant ? "Description" : "Particulars / Description", className: "min-w-40", cell: (a) => a.purpose || a.objectOfExpenditure },
    { key: "deptAfter", only: ["raofe"], header: "Department/Office", hideBelow: "wide", cell: (a) => a.department ?? "—" },
    { key: "amount", header: "Allotment Amount (₱)", align: "right", cell: (a) => money(a.amount) },
    { key: "obligations", header: "Obligations (₱)", align: "right", hideBelow: "md", cell: (a) => money(a.obligated) },
    { key: "disbursements", header: "Disbursements (₱)", align: "right", hideBelow: "wide", cell: (a) => money(disbursedBy.get(a.allotmentNo) ?? 0) },
    { key: "balance", header: "Balance (₱)", align: "right", hideBelow: "lg", cell: (a) => money(a.amount - a.obligated) },
    {
      key: "utilization",
      only: ["overview", "raofe"],
      header: "Utilization",
      hideBelow: "lg",
      cell: (a) => {
        const pct = Math.round(safeRatio(a.obligated, a.amount) * 100);
        return (
          <span className="flex min-w-28 items-center gap-2">
            <span className="w-9 text-xs tabular-nums">{pct}%</span>
            <span className="h-1.5 flex-1 rounded-full bg-gray-100">
              <span className={cn("block h-full rounded-full", raofeVariant ? (pct >= 75 ? "bg-brand-500" : "bg-amber-400") : pct >= 50 ? "bg-amber-400" : pct > 30 ? "bg-blue-500" : "bg-brand-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
            </span>
          </span>
        );
      },
    },
    { key: "status", header: "Status", align: "center", cell: (a) => <RegistryStatusBadge allotment={a} /> },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      cell: (a) => (
        <DropdownMenu
          label={`Actions for ${a.allotmentNo}`}
          triggerClassName="rounded-md px-2 py-0.5 text-gray-600 hover:bg-gray-100"
          trigger={<MoreHorizontal className="size-4" />}
          items={[
            { label: a.status === "For Approval" || a.status === "Unreleased" ? "Open approval" : "View details", icon: Eye, href: allotmentHref(a) },
            { label: "Edit", icon: Pencil, href: ROUTES.editClassAllotment(meta.slug, a.id), disabled: a.workflowType !== "registry" || (a.status !== "Draft" && a.status !== "Returned") },
            { label: "Delete", icon: Trash2, danger: true, disabled: a.status !== "Draft" && a.status !== "Returned", onSelect: () => onDelete(a) },
          ]}
        />
      ),
    },
  ];
  const columns = allColumns.filter((c) => !c.only || c.only.includes(config.listVariant));

  return (
    <>
      <PageHeader
        title={statusVariant || overviewVariant || raofeVariant ? meta.code : `${meta.code} Allotments`}
        description={
          <>
            <span className="block text-lg text-blue-800">{meta.name}</span>
            {raofeVariant
              ? `Manage ${meta.code} allotments for financial expenses, with their obligations and disbursements.`
              : statusVariant
              ? `Manages allotments recorded under ${meta.code} (${meta.expenseClass}) and their obligations and disbursements.`
              : `Manage allotments and obligations recorded under ${meta.code} (${meta.expenseClass}).`}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label={raofeVariant ? "Total Allotment Amount" : "Total Allotment"} value={formatCurrency(totals.allotments)} caption={raofeVariant ? `${formatPercent(safeRatio(totals.allotments, allClassTotal), 1)} of Total Allotments` : `${formatPercent(safeRatio(totals.allotments, classAppropriation), 1)} of ${meta.code} Appropriations`} icon={Wallet} iconTone="blue" progress={{ value: safeRatio(totals.allotments, classAppropriation), tone: "blue" }} loading={loading} />
        <StatCard label="Total Obligations" value={formatCurrency(totals.obligations)} caption={`${formatPercent(safeRatio(totals.obligations, totals.allotments), 1)} of Allotment`} icon={CircleCheck} iconTone="green" progress={{ value: safeRatio(totals.obligations, totals.allotments), tone: "green" }} loading={loading} />
        <StatCard label="Total Disbursements" value={formatCurrency(totals.disbursements)} caption={`${formatPercent(safeRatio(totals.disbursements, totals.allotments), 1)} of Allotment`} icon={HandCoins} iconTone="amber" progress={{ value: safeRatio(totals.disbursements, totals.allotments), tone: "green" }} loading={loading} />
        <StatCard label="Available Balance" value={formatCurrency(totals.balance)} caption={`${formatPercent(safeRatio(totals.balance, totals.allotments), 1)} of Allotment`} icon={FileText} iconTone="dark" progress={{ value: safeRatio(totals.balance, totals.allotments), tone: "amber" }} loading={loading} />
      </div>

      {statusVariant ? (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label={`${meta.code} status`} className="flex flex-wrap gap-2">
            {([
              ["", `All ${meta.code} Allotments`],
              ["active", "Active"],
              ["approval", "For Approval"],
              ["obligated", "Obligated"],
              ["disbursed", "Disbursed"],
              ["closed", "Closed"],
              ["draft", "Drafts & Returned"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={group === value}
                onClick={() => setGroup(value)}
                className={cn(
                  "h-10 rounded-lg border px-4 text-sm font-medium transition-colors",
                  group === value ? "border-brand-600 bg-brand-600 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Link href={ROUTES.newClassAllotment(meta.slug)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
            <Plus className="size-4" /> New {meta.code} Allotment
          </Link>
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label={`${meta.code} sections`} className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "h-10 rounded-lg border px-5 text-sm font-medium transition-colors",
                tab === t.value ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {raofeVariant ? (
          <Link href={ROUTES.newClassAllotment(meta.slug)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
            <Plus className="size-4" /> New {meta.code} Allotment
          </Link>
        ) : (
        <div className="flex flex-wrap gap-2">
          <Link href={ROUTES.gaaUpload} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50">
            <CloudUpload className="size-4" /> {overviewVariant ? "Upload from GAA" : "Import from GAA"}
          </Link>
          <Link href={ROUTES.newClassAllotment(meta.slug)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
            <Plus className="size-4" /> New Allotment
          </Link>
          {overviewVariant && <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Export</Button>}
        </div>
        )}
      </div>

      )}

      {showTable && (
        <>
          <Card className="mb-5 overflow-hidden">
            <div
              className={cn(
                "grid gap-3 px-5 py-4 sm:grid-cols-2 xl:items-end",
                config.listVariant !== "sections" ? "lg:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,12rem))_minmax(0,1fr)]" : "lg:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,11rem))_minmax(0,1fr)]",
              )}
            >
              <F label="Fiscal Year" id="r-fy">
                <Select id="r-fy" value={String(fiscalYear)} onChange={(e) => dispatch(fiscalYearChanged(Number(e.target.value) as FiscalYear))} options={FISCAL_YEARS.map((fy) => ({ value: String(fy), label: `FY ${fy}` }))} />
              </F>
              <F label="Department/Office" id="r-dept">
                <Select id="r-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="All Departments" options={(lookups.data?.departments ?? []).map((d) => ({ value: d, label: d }))} />
              </F>
              {config.listVariant === "sections" && (
                <F label="Source" id="r-fund">
                  <Select id="r-fund" value={fundSource} onChange={(e) => setFundSource(e.target.value)} placeholder="All" options={appLookups.data?.fundSources.map((f) => ({ value: f.code, label: `${f.code} - ${f.name}` })) ?? []} />
                </F>
              )}
              <F label="Status" id="r-status">
                <Select id="r-status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={STATUS_FILTERS.map((s) => ({ value: s, label: s }))} />
              </F>
              <div className={cn("sm:col-span-2 xl:col-span-1", config.listVariant !== "sections" ? "flex gap-2 lg:col-span-3" : "lg:col-span-4")}>
                <label htmlFor="r-search" className="sr-only">Search allotments</label>
                <div className="flex-1">
                  <Input id="r-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={raofeVariant ? `Search ${meta.code} allotment, code, description…` : statusVariant ? "Search allotment no., UACS, description…" : "Search allotment no., description, department…"} leftIcon={<Search className="size-4" />} />
                </div>
                {config.listVariant !== "sections" && (
                  <>
                    <Button variant="outline" onClick={() => { setDepartment(""); setStatus(""); setSearch(""); setGroup(""); }}>Reset</Button>
                    {(statusVariant || raofeVariant) && <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Export</Button>}
                  </>
                )}
              </div>
            </div>
            <DataTable
              dense
              columns={columns}
              rows={paging.pageItems}
              rowKey={(a) => a.id}
              loading={loading}
              error={allotments.error}
              onRetry={allotments.refetch}
              emptyTitle={`No ${meta.code} allotments found`}
              emptyDescription="Adjust the filters or create a new allotment."
              caption={`${meta.code} allotments`}
              footerRow={config.listVariant !== "sections" ? undefined : (
                <tr className="bg-gray-50 font-semibold text-gray-900">
                  <td className="px-3 py-3 pl-5" colSpan={2}>TOTAL</td>
                  <td className="hidden min-[1700px]:table-cell" />
                  <td className="hidden md:table-cell" />
                  <td />
                  <td className="px-2.5 py-3 text-right">{money(rowTotals.amount)}</td>
                  <td className="hidden px-2.5 py-3 text-right md:table-cell">{money(rowTotals.obligations)}</td>
                  <td className="hidden px-2.5 py-3 text-right xl:table-cell">{money(rowTotals.disbursements)}</td>
                  <td className="hidden px-2.5 py-3 text-right lg:table-cell">{money(rowTotals.amount - rowTotals.obligations)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            />
            {paging.total > 0 && (
              <div className="flex flex-wrap items-center justify-between border-t border-gray-100">
                <Pagination page={paging.page} pageSize={paging.pageSize} total={paging.total} onPageChange={paging.setPage} pageSizeOptions={[10, 25, 50]} onPageSizeChange={paging.setPageSize} />
                <div className="px-5 pb-3 sm:pb-0"><Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button></div>
              </div>
            )}
          </Card>
          {tab === "allotments" && !raofeVariant ? null : loading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : raofeVariant ? (
            <RaofeCharts code={meta.code} rows={byExpenseType} />
          ) : tab === "allotments" ? null : loading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : overviewVariant ? (
            <>
              <RegistryOverviewCharts code={meta.code} totals={totals} byAllotment={byAllotmentChart} />
              <RecentTransactions items={recent} onViewAll={() => setTab("obligations")} />
            </>
          ) : statusVariant ? (
            <RegistryUacsCharts code={meta.code} byUacs={byUacs} totals={totals} />
          ) : (
            <RegistryCharts totals={totals} byTranche={byTranche} byDepartment={byDepartment} />
          )}
        </>
      )}

      {(tab === "obligations" || tab === "disbursements") && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{tab === "obligations" ? `${meta.code} Obligations` : `${meta.code} Disbursements`}</h2>
            <p className="text-sm text-gray-500">{tab === "obligations" ? "Obligations charged to allotments in this class." : "Obligations with disbursements recorded."}</p>
          </div>
          <DataTable
            dense
            columns={registryEntryColumns}
            rows={registry.data?.entries.filter((e) => (tab === "obligations" ? e.status !== "Draft" : e.disbursement > 0))}
            rowKey={(e) => e.id}
            loading={registry.isLoading}
            error={registry.error}
            onRetry={registry.refetch}
            caption={`${meta.code} ${tab}`}
          />
        </Card>
      )}

      {tab === "tranches" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{meta.code} Tranches</h2>
            <p className="text-sm text-gray-500">Allotments, obligations and disbursements per tranche.</p>
          </div>
          <DataTable
            dense
            columns={[
              { key: "tranche", header: "Tranche", cell: (t: (typeof byTranche)[number]) => t.tranche },
              { key: "allotment", header: "Allotment Amount (₱)", align: "right", cell: (t: (typeof byTranche)[number]) => money(t.allotment) },
              { key: "obligations", header: "Obligations (₱)", align: "right", cell: (t: (typeof byTranche)[number]) => money(t.obligations) },
              { key: "disbursements", header: "Disbursements (₱)", align: "right", hideBelow: "md", cell: (t: (typeof byTranche)[number]) => money(t.disbursements) },
              { key: "balance", header: "Balance (₱)", align: "right", hideBelow: "md", cell: (t: (typeof byTranche)[number]) => money(t.allotment - t.obligations) },
              { key: "util", header: "Utilization", align: "right", cell: (t: (typeof byTranche)[number]) => formatPercent(safeRatio(t.obligations, t.allotment), 1) },
            ]}
            rows={byTranche}
            rowKey={(t) => t.tranche}
            loading={loading}
            emptyTitle="No approved allotments yet"
            caption={`${meta.code} tranches`}
          />
        </Card>
      )}

      {tab === "balances" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{meta.code} Balances</h2>
            <p className="text-sm text-gray-500">Unobligated balance and unpaid obligations per approved allotment.</p>
          </div>
          <DataTable
            dense
            columns={[
              { key: "no", header: "Allotment No.", cell: (a: Allotment) => <Link href={allotmentHref(a)} className="text-blue-700 hover:underline">{a.allotmentNo}</Link> },
              { key: "dept", header: "Department/Office", hideBelow: "md", cell: (a: Allotment) => a.department ?? "—" },
              { key: "amount", header: "Allotment", align: "right", cell: (a: Allotment) => money(a.amount) },
              { key: "obl", header: "Obligations", align: "right", cell: (a: Allotment) => money(a.obligated) },
              { key: "unobl", header: "Unobligated Balance", align: "right", cell: (a: Allotment) => money(a.amount - a.obligated) },
              { key: "disb", header: "Disbursements", align: "right", hideBelow: "lg", cell: (a: Allotment) => money(disbursedBy.get(a.allotmentNo) ?? 0) },
              { key: "unpaid", header: "Unpaid Obligations", align: "right", hideBelow: "lg", cell: (a: Allotment) => money(a.obligated - (disbursedBy.get(a.allotmentNo) ?? 0)) },
            ]}
            rows={valid}
            rowKey={(a) => a.id}
            loading={loading}
            caption={`${meta.code} balances`}
          />
        </Card>
      )}

      {tab === "reports" && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-gray-900">{meta.code} Reports</h2>
          <p className="text-sm text-gray-500">Reports that include {meta.code} figures.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {BFARS_REPORTS.filter((r) => ["bfars-2", "bfars-3", "bfars-4", "bfars-8"].includes(r.id)).map((r) => (
              <Link key={r.id} href={ROUTES.bfars(r.id)} className="flex gap-3 rounded-xl border border-gray-200 p-4 hover:shadow-md">
                <FileBarChart className="size-6 shrink-0 text-brand-600" aria-hidden />
                <span className="text-sm">
                  <span className="block font-semibold text-gray-900">BFARS {r.number} – {r.code}</span>
                  <span className="text-gray-600">{r.title}</span>
                </span>
              </Link>
            ))}
            <button type="button" onClick={exportCsv} className="flex gap-3 rounded-xl border border-gray-200 p-4 text-left hover:shadow-md">
              <Download className="size-6 shrink-0 text-blue-600" aria-hidden />
              <span className="text-sm">
                <span className="block font-semibold text-gray-900">{meta.code} Allotment Register (CSV)</span>
                <span className="text-gray-600">Download the allotments shown on this page.</span>
              </span>
            </button>
          </div>
        </Card>
      )}
    </>
  );
}

function F({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

interface RecentItem {
  id: string;
  date: string;
  type: "Allotment" | "Obligation" | "Disbursement";
  ref: string;
  particulars: string;
  amount: number;
  by: string;
  status: string;
  href: string;
}

const TYPE_TONE: Record<RecentItem["type"], string> = {
  Allotment: "bg-red-50 text-red-700",
  Obligation: "bg-amber-50 text-amber-800",
  Disbursement: "bg-blue-50 text-blue-700",
};

function RecentTransactions({ items, onViewAll }: { items: RecentItem[]; onViewAll: () => void }) {
  return (
    <Card className="mt-5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        <button type="button" onClick={onViewAll} className="text-sm font-medium text-blue-600 hover:underline">View All</button>
      </div>
      <DataTable
        dense
        rows={items}
        rowKey={(t) => t.id}
        caption="Recent transactions"
        emptyTitle="No transactions yet"
        columns={[
          { key: "date", header: "Date", cell: (t) => <span className="whitespace-nowrap">{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span> },
          { key: "type", header: "Transaction Type", cell: (t) => <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", TYPE_TONE[t.type])}>{t.type}</span> },
          { key: "ref", header: "Reference No.", cell: (t) => <Link href={t.href} className="whitespace-nowrap text-blue-700 hover:underline">{t.ref}</Link> },
          { key: "particulars", header: "Particulars", hideBelow: "md", cell: (t) => t.particulars },
          { key: "amount", header: "Amount (₱)", align: "right", cell: (t) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(t.amount).replace("₱", "")}</span> },
          { key: "by", header: "Prepared By / Payee", hideBelow: "lg", cell: (t) => t.by },
          { key: "status", header: "Status", align: "center", cell: (t) => <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">{t.status}</span> },
        ]}
      />
    </Card>
  );
}
