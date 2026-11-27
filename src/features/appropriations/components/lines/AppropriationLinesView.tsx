"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, CloudUpload, Database, Eye, FilePlus2, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BackendRequired, MissingFiscalYear } from "@/components/backend/DataSourceNotice";
import { PromptDialog } from "@/components/backend/PromptDialog";
import { LookupSelect } from "@/features/master-data/components/LookupSelect";
import { useBackendFiscalYear } from "@/hooks/useBackendFiscalYear";
import { useCan } from "@/hooks/useCan";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useNotify } from "@/hooks/useNotify";
import { ROUTES } from "@/lib/constants/routes";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/format";
import { pesos } from "@/types/backend";
import { useDeleteAppropriationLineMutation, useGetAppropriationLinesQuery } from "../../services/appropriationLinesApi";
import { APPROPRIATION_LEVELS, APPROPRIATION_TYPES, type AppropriationLevel, type AppropriationLine, type AppropriationType } from "../../types/lines";

export function AppropriationLinesView() {
  const canManage = useCan("appropriations.manage");
  return (
    <>
      <PageHeader
        title="Appropriations"
        description="Each fiscal year's authorized budget, one line per organization, PAP, UACS object and fund source."
        actions={
          canManage ? (
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
          ) : undefined
        }
      />
      <BackendRequired>
        <LinesTable />
      </BackendRequired>
    </>
  );
}

function LinesTable() {
  const notify = useNotify();
  const fy = useBackendFiscalYear();
  const canManage = useCan("appropriations.manage");
  const canAllot = useCan("allotments.manage");
  const [organization, setOrganization] = useState("");
  const [allotmentClass, setAllotmentClass] = useState("");
  const [fundSource, setFundSource] = useState("");
  const [type, setType] = useState<AppropriationType | "">("");
  const [level, setLevel] = useState<AppropriationLevel | "">("");
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft.trim(), 350);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [selected, setSelected] = useState<AppropriationLine | null>(null);
  const [deleting, setDeleting] = useState<AppropriationLine | null>(null);
  const [remove] = useDeleteAppropriationLineMutation();

  useEffect(() => setPage(1), [organization, allotmentClass, fundSource, type, level, search, perPage, fy.id]);

  const list = useGetAppropriationLinesQuery(
    {
      fiscal_year_id: fy.id,
      organization_id: organization ? Number(organization) : undefined,
      allotment_class_id: allotmentClass ? Number(allotmentClass) : undefined,
      fund_source_id: fundSource ? Number(fundSource) : undefined,
      type: type || undefined,
      level: level || undefined,
      search: search || undefined,
      page,
      per_page: perPage,
    },
    { skip: !fy.id },
  );
  const total = pesos(list.data?.meta?.total_amount as string | undefined);
  const editable = fy.record?.status === "open";
  const loading = fy.isLoading || (list.isFetching && !list.currentData);

  const columns: Column<AppropriationLine>[] = [
    { key: "no", header: "No.", cell: (l) => <span className="font-medium whitespace-nowrap text-gray-900">{l.appropriation_no}</span> },
    { key: "org", header: "Org Code", hideBelow: "xl", cell: (l) => <span className="whitespace-nowrap" title={l.organization?.name}>{l.organization?.code ?? "—"}</span> },
    { key: "uacs", header: "UACS Code", cell: (l) => <span className="tabular-nums">{l.uacs_object?.code ?? "—"}</span> },
    {
      key: "desc",
      header: "Description",
      className: "min-w-48",
      cell: (l) => (
        <span>
          {l.uacs_object?.description ?? l.title}
          {l.title && <span className="block text-xs text-gray-500">{l.title}</span>}
        </span>
      ),
    },
    { key: "pap", header: "PAP", hideBelow: "lg", className: "min-w-40", cell: (l) => <span title={l.prexc_item?.code}>{l.prexc_item?.description ?? "—"}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (l) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(pesos(l.amount))}</span> },
    { key: "allotted", header: "Allotted", align: "right", hideBelow: "md", cell: (l) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(pesos(l.allotted_amount))}</span> },
    { key: "class", header: "Class", align: "center", cell: (l) => <Badge tone="blue">{l.allotment_class?.code ?? "—"}</Badge> },
    { key: "fund", header: "Fund", hideBelow: "md", cell: (l) => <span title={l.fund_source?.description}>{l.fund_source?.code ?? "—"}</span> },
    { key: "type", header: "Type", hideBelow: "wide", cell: (l) => l.type_label },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      cell: (l) => (
        <DropdownMenu
          label={`Actions for ${l.appropriation_no}`}
          triggerClassName="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
          trigger={<MoreHorizontal className="size-4" />}
          items={[
            { label: "View details", icon: Eye, onSelect: () => setSelected(l) },
            ...(canManage ? [{ label: "Edit", icon: Pencil, href: ROUTES.editAppropriation(l.id), disabled: !editable }] : []),
            ...(canAllot
              ? [
                  l.allotment
                    ? { label: `Open ${l.allotment.allotment_no}`, icon: Wallet, href: ROUTES.allotment(l.allotment.id) }
                    : { label: "Create allotment", icon: FilePlus2, href: `${ROUTES.newAllotment}?appropriation=${l.id}`, disabled: !editable },
                ]
              : []),
            ...(canManage ? [{ label: "Delete", icon: Trash2, danger: true, disabled: !editable || !!l.allotment, onSelect: () => setDeleting(l) }] : []),
          ]}
        />
      ),
    },
  ];

  if (fy.missing) return <MissingFiscalYear year={fy.year} />;

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <StatCard label="Total Appropriations" value={formatCurrency(total)} caption={`FY ${fy.year}, matching the filters`} icon={Database} iconTone="red" loading={loading} />
        <StatCard label="Number of Lines" value={formatNumber(list.data?.total ?? 0)} caption="Appropriation lines" icon={FileText} iconTone="dark" loading={loading} />
        <StatCard
          label="Fiscal Year Status"
          value={fy.record ? fy.record.status.charAt(0).toUpperCase() + fy.record.status.slice(1) : "—"}
          caption={editable ? "Lines can be added and changed" : "Lines are read-only"}
          icon={FileText}
          iconTone={editable ? "green" : "blue"}
          loading={fy.isLoading}
        />
      </div>

      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6 xl:items-end">
          <Filter label="Organization" id="f-org">
            <LookupSelect id="f-org" kind="organization" value={organization} onChange={setOrganization} placeholder="All" />
          </Filter>
          <Filter label="Allotment Class" id="f-class">
            <LookupSelect id="f-class" kind="class" value={allotmentClass} onChange={setAllotmentClass} placeholder="All" />
          </Filter>
          <Filter label="Fund Source" id="f-fund">
            <LookupSelect id="f-fund" kind="fund" value={fundSource} onChange={setFundSource} placeholder="All" />
          </Filter>
          <Filter label="Type" id="f-type">
            <Select id="f-type" value={type} onChange={(e) => setType(e.target.value as AppropriationType | "")} placeholder="All" options={APPROPRIATION_TYPES} />
          </Filter>
          <Filter label="Level" id="f-level">
            <Select id="f-level" value={level} onChange={(e) => setLevel(e.target.value as AppropriationLevel | "")} placeholder="All" options={APPROPRIATION_LEVELS} />
          </Filter>
          <Filter label="Search" id="f-search">
            <Input id="f-search" type="search" maxLength={100} value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="No., title, codes…" leftIcon={<Search className="size-4" />} />
          </Filter>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOrganization("");
              setAllotmentClass("");
              setFundSource("");
              setType("");
              setLevel("");
              setSearchDraft("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <p className="text-sm text-gray-600">{fy.record ? `${fy.record.name} · ${fy.record.status}` : ""}</p>
          <Link href={ROUTES.gaaUpload} className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <CloudUpload className="size-4" /> Upload GAA
          </Link>
        </div>
        <div className="border-t border-gray-100">
          <DataTable
            dense
            columns={columns}
            rows={list.data?.items}
            rowKey={(l) => String(l.id)}
            loading={loading}
            error={list.error ?? fy.error}
            onRetry={list.refetch}
            emptyTitle="No appropriation lines"
            emptyDescription={canManage ? "Create a line or import a GAA file." : "Adjust the filters."}
            caption="Appropriation lines"
            footerRow={
              <tr className="bg-gray-50 font-semibold text-gray-900">
                <td colSpan={5} className="px-5 py-3 text-right">
                  Total of all matching lines
                </td>
                <td className="px-2.5 py-3 text-right tabular-nums">{formatCurrency(total)}</td>
                <td colSpan={5} />
              </tr>
            }
          />
        </div>
        {list.data && list.data.total > 0 && (
          <div className="border-t border-gray-100">
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} pageSizeOptions={[15, 30, 50, 100]} onPageSizeChange={setPerPage} />
          </div>
        )}
      </Card>

      <LineDetailModal line={selected} onClose={() => setSelected(null)} />
      <PromptDialog
        open={!!deleting}
        title={`Delete ${deleting?.appropriation_no}?`}
        description="The line is removed. Its number is not reused."
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await remove(deleting.id).unwrap();
          notify("success", "Appropriation deleted", deleting.appropriation_no);
        }}
      />
    </>
  );
}

function Filter({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

export function LineDetailModal({ line, onClose }: { line: AppropriationLine | null; onClose: () => void }) {
  const rows: [string, React.ReactNode][] = line
    ? [
        ["Fiscal year", line.fiscal_year?.name ?? "—"],
        ["Organization", line.organization ? `${line.organization.code} – ${line.organization.name}` : "—"],
        ["Level / Type", `${line.level_label} · ${line.type_label}`],
        ["Title", line.title ?? "—"],
        ["Legal reference", line.legal_reference ?? "—"],
        ["Period", `${formatDate(line.effectivity_date)} – ${line.expiry_date ? formatDate(line.expiry_date) : "no set end"}`],
        ["PAP", line.prexc_item ? `${line.prexc_item.code} – ${line.prexc_item.description}` : "—"],
        ["UACS object", line.uacs_object ? `${line.uacs_object.code} – ${line.uacs_object.description}` : "—"],
        ["Fund source", line.fund_source ? `${line.fund_source.code} – ${line.fund_source.description}` : "—"],
        ["Allotment class", line.allotment_class ? `${line.allotment_class.code} – ${line.allotment_class.description}` : "—"],
        ["Amount", formatCurrency(pesos(line.amount))],
        ["Allotted", formatCurrency(pesos(line.allotted_amount))],
        ["Unallotted", formatCurrency(pesos(line.unallotted_amount))],
        [
          "Allotment",
          line.allotment ? (
            <Link href={ROUTES.allotment(line.allotment.id)} className="text-blue-600 hover:underline">
              {line.allotment.allotment_no} <StatusBadge status={line.allotment.status_label} />
            </Link>
          ) : (
            "None yet"
          ),
        ],
        ["Remarks", line.remarks ?? "—"],
      ]
    : [];
  return (
    <Modal open={!!line} onClose={onClose} title={line?.appropriation_no ?? ""} size="lg" footer={<Button onClick={onClose}>Close</Button>}>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{k}</dt>
            <dd className="text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
