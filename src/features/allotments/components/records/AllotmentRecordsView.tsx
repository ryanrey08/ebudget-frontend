"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Layers, Plus, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BackendRequired, MissingFiscalYear } from "@/components/backend/DataSourceNotice";
import { LookupSelect } from "@/features/master-data/components/LookupSelect";
import { useBackendFiscalYear } from "@/hooks/useBackendFiscalYear";
import { useCan } from "@/hooks/useCan";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ROUTES } from "@/lib/constants/routes";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/format";
import { pesos } from "@/types/backend";
import { useGetAllotmentRecordsQuery } from "../../services/allotmentRecordsApi";
import { ALLOTMENT_RECORD_STATUSES, type AllotmentRecord, type AllotmentRecordStatus } from "../../types/records";

/** Released / pending of the tranches the list includes (list rows carry `releases`). */
export function trancheTotals(a: AllotmentRecord) {
  const sum = (status: string) => (a.releases ?? []).filter((r) => r.status === status).reduce((t, r) => t + pesos(r.amount), 0);
  return { released: a.released_amount !== undefined ? pesos(a.released_amount) : sum("released"), pending: a.pending_amount !== undefined ? pesos(a.pending_amount) : sum("pending") };
}

export function AllotmentRecordsView() {
  const canManage = useCan("allotments.manage");
  return (
    <>
      <PageHeader
        title="Allotments"
        description="Amounts set aside from appropriation lines, released in tranches that each go through approval."
        actions={
          canManage ? (
            <Link href={ROUTES.newAllotment} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              <Plus className="size-4" /> New Allotment
            </Link>
          ) : undefined
        }
      />
      <BackendRequired>
        <RecordsTable />
      </BackendRequired>
    </>
  );
}

function RecordsTable() {
  const router = useRouter();
  const fy = useBackendFiscalYear();
  const [status, setStatus] = useState<AllotmentRecordStatus | "">("");
  const [organization, setOrganization] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft.trim(), 350);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  useEffect(() => setPage(1), [status, organization, search, perPage, fy.id]);

  const list = useGetAllotmentRecordsQuery(
    { fiscal_year_id: fy.id, status: status || undefined, organization_id: organization ? Number(organization) : undefined, search: search || undefined, page, per_page: perPage },
    { skip: !fy.id },
  );
  const loading = fy.isLoading || (list.isFetching && !list.currentData);
  const pageRows = list.data?.items ?? [];
  const pageReleased = pageRows.reduce((t, a) => t + trancheTotals(a).released, 0);
  const pagePending = pageRows.reduce((t, a) => t + trancheTotals(a).pending, 0);

  const columns: Column<AllotmentRecord>[] = [
    { key: "no", header: "Allotment No.", cell: (a) => <span className="font-medium whitespace-nowrap text-gray-900">{a.allotment_no}</span> },
    { key: "line", header: "Appropriation", cell: (a) => <span className="whitespace-nowrap">{a.appropriation?.appropriation_no ?? `#${a.appropriation_id}`}</span> },
    {
      key: "purpose",
      header: "Purpose",
      className: "min-w-56",
      cell: (a) => (
        <span>
          {a.purpose}
          {a.appropriation?.uacs_object && <span className="block text-xs text-gray-500">{`${a.appropriation.uacs_object.code} – ${a.appropriation.uacs_object.description}`}</span>}
        </span>
      ),
    },
    { key: "class", header: "Class", align: "center", hideBelow: "md", cell: (a) => a.appropriation?.allotment_class?.code ?? "—" },
    { key: "amount", header: "Allotment", align: "right", cell: (a) => <span className="tabular-nums">{formatCurrency(pesos(a.amount))}</span> },
    { key: "released", header: "Released", align: "right", hideBelow: "lg", cell: (a) => <span className="tabular-nums">{formatCurrency(trancheTotals(a).released)}</span> },
    { key: "tranches", header: "Tranches", align: "center", hideBelow: "lg", cell: (a) => a.releases?.length ?? 0 },
    { key: "created", header: "Created", hideBelow: "xl", cell: (a) => formatDate(a.created_at) },
    { key: "status", header: "Status", align: "center", cell: (a) => <StatusBadge status={a.status_label} /> },
  ];

  if (fy.missing) return <MissingFiscalYear year={fy.year} />;

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Total Allotments" value={formatCurrency(pesos(list.data?.meta?.total_amount as string | undefined))} caption={`FY ${fy.year}, matching the filters`} icon={Wallet} iconTone="red" loading={loading} />
        <StatCard label="Number of Allotments" value={formatNumber(list.data?.total ?? 0)} caption="Matching the filters" icon={Layers} iconTone="dark" loading={loading} />
        <StatCard label="Released (this page)" value={formatCurrency(pageReleased)} caption="Approved tranches" icon={Wallet} iconTone="green" loading={loading} />
        <StatCard label="Pending Approval (this page)" value={formatCurrency(pagePending)} caption="Submitted tranches" icon={Clock} iconTone="blue" loading={loading} />
      </div>

      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-end">
          <div>
            <label htmlFor="al-org" className="mb-1.5 block text-sm font-medium text-gray-700">
              Organization
            </label>
            <LookupSelect id="al-org" kind="organization" value={organization} onChange={setOrganization} placeholder="All" />
          </div>
          <div>
            <label htmlFor="al-search" className="mb-1.5 block text-sm font-medium text-gray-700">
              Search
            </label>
            <Input id="al-search" type="search" maxLength={100} value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Allotment no., purpose, appropriation no. or title" leftIcon={<Search className="size-4" />} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-3">
          <Tabs
            label="Allotment status"
            className="border-b-0"
            value={status}
            onChange={setStatus}
            items={[{ value: "" as const, label: "All" }, ...ALLOTMENT_RECORD_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
          />
        </div>
        <div className="border-t border-gray-100">
          <DataTable
            dense
            columns={columns}
            rows={list.data?.items}
            rowKey={(a) => a.id}
            loading={loading}
            error={list.error ?? fy.error}
            onRetry={list.refetch}
            onRowClick={(a) => router.push(ROUTES.allotment(a.id))}
            emptyTitle="No allotments"
            emptyDescription="Create one from an appropriation line."
            caption="Allotments"
          />
        </div>
        {list.data && list.data.total > 0 && (
          <div className="border-t border-gray-100">
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} pageSizeOptions={[15, 30, 50, 100]} onPageSizeChange={setPerPage} />
          </div>
        )}
      </Card>
      <p className="mt-2 text-xs text-gray-500">
        Released and pending totals cover the rows on this page; open an allotment for its full figures.
      </p>
    </>
  );
}
