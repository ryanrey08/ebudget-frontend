"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PromptDialog } from "@/components/backend/PromptDialog";
import { ResourceManager, formToInput, type FieldDef, type ResourceConfig } from "@/components/backend/ResourceManager";
import { useCan } from "@/hooks/useCan";
import { useNotify } from "@/hooks/useNotify";
import { formatDate } from "@/lib/utils/format";
import {
  useCreateAllotmentClassRecordMutation,
  useCreateFiscalYearMutation,
  useCreateFundSourceMutation,
  useCreateOrganizationMutation,
  useCreatePrexcItemMutation,
  useCreateUacsObjectMutation,
  useDeleteAllotmentClassRecordMutation,
  useDeleteFiscalYearMutation,
  useDeleteFundSourceMutation,
  useDeleteOrganizationMutation,
  useDeletePrexcItemMutation,
  useDeleteUacsObjectMutation,
  useGetAllotmentClassRecordQuery,
  useGetAllotmentClassRecordsQuery,
  useGetFiscalYearQuery,
  useGetFundSourceQuery,
  useGetOrganizationQuery,
  useGetPrexcItemQuery,
  useGetUacsObjectQuery,
  useGetFiscalYearsQuery,
  useGetFundSourcesQuery,
  useGetOrganizationsQuery,
  useGetPrexcItemsQuery,
  useGetUacsObjectsQuery,
  useTransitionFiscalYearMutation,
  useUpdateAllotmentClassRecordMutation,
  useUpdateFiscalYearMutation,
  useUpdateFundSourceMutation,
  useUpdateOrganizationMutation,
  useUpdatePrexcItemMutation,
  useUpdateUacsObjectMutation,
} from "../services/masterDataApi";
import {
  ALLOTMENT_REGISTRY_CODES,
  type AllotmentClassQuery,
  type AllotmentClassRecord,
  type AllotmentRegistryCode,
  type CodeListQuery,
  type FiscalYearQuery,
  type FiscalYearRecord,
  type FiscalYearStatus,
  type FiscalYearTransition,
  type FundSource,
  type Organization,
  type PrexcItem,
  type PrexcItemQuery,
  type UacsObject,
} from "../types";

/* The generic manager types its hooks loosely; each config passes the typed RTK hooks. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = <T,>(hook: T) => hook as any;

const activeColumn = <T extends { is_active: boolean }>() => ({
  key: "active",
  header: "Status",
  align: "center" as const,
  cell: (r: T) => <StatusBadge status={r.is_active ? "Active" : "Inactive"} />,
});

const activeField: FieldDef = { name: "is_active", label: "Active", type: "checkbox", hint: "inactive records stay listed but can't be used on new lines" };

const codeListQuery = ({ page, per_page, search, active }: { page: number; per_page: number; search: string; active: "" | "1" | "0" }): CodeListQuery => ({
  page,
  per_page,
  search: search || undefined,
  is_active: active === "" ? undefined : (Number(active) as 0 | 1),
});

/* ── Fund sources ───────────────────────────────────────────────────────── */

const fundSourcesConfig: ResourceConfig<FundSource, CodeListQuery> = {
  title: "Fund Sources",
  description: "The fund classifications (FUNDCD) used by appropriation lines.",
  singular: "fund source",
  permissions: { view: "fund_sources.view", manage: "fund_sources.manage" },
  useList: useGetFundSourcesQuery,
  useCreate: loose(useCreateFundSourceMutation),
  useUpdate: loose(useUpdateFundSourceMutation),
  useDelete: loose(useDeleteFundSourceMutation),
  useGet: useGetFundSourceQuery,
  columns: [
    { key: "code", header: "Code", cell: (r) => <span className="font-medium tabular-nums">{r.code}</span> },
    { key: "description", header: "Description", cell: (r) => r.description },
    activeColumn<FundSource>(),
  ],
  fields: [
    { name: "code", label: "Code (FUNDCD)", type: "text", required: true, max: 20 },
    { name: "description", label: "Description", type: "text", required: true, max: 255, wide: true },
    activeField,
  ],
  toForm: (r) => ({ code: r.code, description: r.description, is_active: r.is_active }),
  buildQuery: codeListQuery,
  search: { placeholder: "Code or description" },
  activeFilter: true,
  rowLabel: (r) => r.code,
};
export const FundSourcesView = () => <ResourceManager config={fundSourcesConfig} />;

/* ── Organizations ──────────────────────────────────────────────────────── */

const organizationsConfig: ResourceConfig<Organization, CodeListQuery> = {
  title: "Organizations",
  description: "Government agencies, departments, bureaus and offices. Only active ones can take appropriations.",
  singular: "organization",
  permissions: { view: "organizations.view", manage: "organizations.manage" },
  useList: useGetOrganizationsQuery,
  useCreate: loose(useCreateOrganizationMutation),
  useUpdate: loose(useUpdateOrganizationMutation),
  useDelete: loose(useDeleteOrganizationMutation),
  useGet: useGetOrganizationQuery,
  columns: [
    { key: "code", header: "Code", cell: (r) => <span className="font-medium tabular-nums">{r.code}</span> },
    { key: "name", header: "Name", cell: (r) => r.name },
    activeColumn<Organization>(),
  ],
  fields: [
    { name: "code", label: "Code", type: "text", required: true, max: 20 },
    { name: "name", label: "Name", type: "text", required: true, max: 255, wide: true },
    activeField,
  ],
  toForm: (r) => ({ code: r.code, name: r.name, is_active: r.is_active }),
  buildQuery: codeListQuery,
  search: { placeholder: "Code or name" },
  activeFilter: true,
  rowLabel: (r) => r.code,
};
export const OrganizationsView = () => <ResourceManager config={organizationsConfig} />;

/* ── UACS objects ───────────────────────────────────────────────────────── */

const uacsConfig: ResourceConfig<UacsObject, CodeListQuery> = {
  title: "UACS Objects",
  description: "Object codes of the Unified Accounts Code Structure (UACS_OBJ_CD / UACS_OBJ_DSC).",
  singular: "UACS object",
  permissions: { view: "uacs_objects.view", manage: "uacs_objects.manage" },
  useList: useGetUacsObjectsQuery,
  useCreate: loose(useCreateUacsObjectMutation),
  useUpdate: loose(useUpdateUacsObjectMutation),
  useDelete: loose(useDeleteUacsObjectMutation),
  useGet: useGetUacsObjectQuery,
  columns: [
    { key: "code", header: "Object Code", cell: (r) => <span className="font-medium tabular-nums">{r.code}</span> },
    { key: "description", header: "Description", cell: (r) => r.description },
    activeColumn<UacsObject>(),
  ],
  fields: [
    { name: "code", label: "Object code", type: "text", required: true, max: 20 },
    { name: "description", label: "Description", type: "text", required: true, max: 255, wide: true },
    activeField,
  ],
  toForm: (r) => ({ code: r.code, description: r.description, is_active: r.is_active }),
  buildQuery: codeListQuery,
  search: { placeholder: "Code or description" },
  activeFilter: true,
  rowLabel: (r) => r.code,
};
export const UacsObjectsView = () => <ResourceManager config={uacsConfig} />;

/* ── Allotment classes ──────────────────────────────────────────────────── */

const registryOptions = ALLOTMENT_REGISTRY_CODES.map((c) => ({ value: c, label: c }));

const allotmentClassesConfig: ResourceConfig<AllotmentClassRecord, AllotmentClassQuery> = {
  title: "Allotment Classes",
  description: "PS, MOOE, CO and FE, each recorded in its own Registry of Allotments and Obligations (RAO).",
  singular: "allotment class",
  permissions: { view: "allotment_classes.view", manage: "allotment_classes.manage" },
  useList: useGetAllotmentClassRecordsQuery,
  useCreate: loose(useCreateAllotmentClassRecordMutation),
  useUpdate: loose(useUpdateAllotmentClassRecordMutation),
  useDelete: loose(useDeleteAllotmentClassRecordMutation),
  useGet: useGetAllotmentClassRecordQuery,
  columns: [
    { key: "code", header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
    { key: "description", header: "Description", cell: (r) => r.description },
    { key: "registry", header: "Registry", cell: (r) => <span title={r.registry_label}><Badge tone="blue">{r.registry_code}</Badge></span> },
    { key: "label", header: "Registry Name", hideBelow: "lg", cell: (r) => <span className="text-gray-500">{r.registry_label}</span> },
    activeColumn<AllotmentClassRecord>(),
  ],
  fields: [
    { name: "code", label: "Code", type: "text", required: true, max: 10 },
    { name: "registry_code", label: "Registry", type: "select", required: true, options: registryOptions, hint: "Each registry belongs to one class." },
    { name: "description", label: "Description", type: "text", required: true, max: 255, wide: true },
    activeField,
  ],
  toForm: (r) => ({ code: r.code, description: r.description, registry_code: r.registry_code, is_active: r.is_active }),
  buildQuery: ({ filter, ...rest }) => ({ ...codeListQuery(rest), registry_code: (filter || undefined) as AllotmentRegistryCode | undefined }),
  search: { placeholder: "Code or description" },
  activeFilter: true,
  extraFilter: { label: "Registry", options: registryOptions },
  rowLabel: (r) => r.code,
};
export const AllotmentClassRecordsView = () => <ResourceManager config={allotmentClassesConfig} />;

/* ── PREXC items ────────────────────────────────────────────────────────── */

export function PrexcItemsView() {
  // Parent choices: every item (headings first), up to the API maximum.
  const parents = useGetPrexcItemsQuery({ per_page: 100 });
  const config = useMemo<ResourceConfig<PrexcItem, PrexcItemQuery>>(() => {
    const parentOptions = (parents.data?.items ?? []).map((p) => ({ value: String(p.id), label: `${p.code} – ${p.description}${p.is_parent_only ? " (heading)" : ""}` }));
    const fields: FieldDef[] = [
      { name: "code", label: "Code (PREXC_FPAP_ID)", type: "text", required: true, max: 30 },
      { name: "level", label: "Level", type: "number", required: true, min: 1, hint: "Stored as given: send the new level when moving an item." },
      { name: "parent_id", label: "Parent item", type: "select", options: parentOptions, placeholder: "None (top level)", nullable: true, wide: true },
      { name: "description", label: "Description", type: "textarea", required: true, max: 2000 },
      { name: "sort_order", label: "Sort order", type: "number", min: 0 },
      { name: "is_parent_only", label: "Heading only", type: "checkbox", hint: "groups other items and never takes an amount" },
      activeField,
    ];
    return {
      title: "PREXC Items",
      description: "The Program Expenditure Classification hierarchy. Headings group items and never take amounts.",
      singular: "PREXC item",
      permissions: { view: "prexc_items.view", manage: "prexc_items.manage" },
      useList: useGetPrexcItemsQuery,
      useCreate: loose(useCreatePrexcItemMutation),
      useUpdate: loose(useUpdatePrexcItemMutation),
      useDelete: loose(useDeletePrexcItemMutation),
      useGet: useGetPrexcItemQuery,
      columns: [
        { key: "code", header: "Code", cell: (r) => <span className="font-medium tabular-nums">{r.code}</span> },
        {
          key: "description",
          header: "Description",
          className: "min-w-64",
          cell: (r) => (
            <span style={{ paddingLeft: `${Math.max(0, r.level - 1) * 12}px` }} className="block">
              {r.description}
              {r.parent && <span className="block text-xs text-gray-500">under {r.parent.code}</span>}
            </span>
          ),
        },
        { key: "level", header: "Level", align: "center", cell: (r) => r.level },
        { key: "type", header: "Type", align: "center", cell: (r) => (r.is_parent_only ? <Badge tone="purple">Heading</Badge> : <Badge tone="green">Takes amounts</Badge>) },
        { key: "children", header: "Children", align: "center", hideBelow: "md", cell: (r) => r.children_count },
        { key: "sort", header: "Sort", align: "center", hideBelow: "lg", cell: (r) => r.sort_order },
        activeColumn<PrexcItem>(),
      ],
      fields,
      toForm: (r) => ({
        code: r.code,
        level: String(r.level),
        parent_id: r.parent ? String(r.parent.id) : "",
        description: r.description,
        sort_order: String(r.sort_order),
        is_parent_only: r.is_parent_only,
        is_active: r.is_active,
      }),
      createDefaults: { level: "1", sort_order: "0", is_parent_only: false, is_active: true },
      toInput: (values, mode, original) => {
        const initial = original
          ? { code: original.code, level: String(original.level), parent_id: original.parent ? String(original.parent.id) : "", description: original.description, sort_order: String(original.sort_order), is_parent_only: original.is_parent_only, is_active: original.is_active }
          : undefined;
        const input = formToInput(fields, values, mode, initial);
        if (typeof input.parent_id === "string") input.parent_id = Number(input.parent_id);
        return input;
      },
      buildQuery: ({ page, per_page, search, active, filter }) => ({
        page,
        per_page,
        search: search || undefined,
        is_active: active === "" ? undefined : (Number(active) as 0 | 1),
        is_parent_only: filter === "" ? undefined : (Number(filter) as 0 | 1),
      }),
      search: { placeholder: "Code or description" },
      activeFilter: true,
      extraFilter: { label: "Type", options: [{ value: "1", label: "Headings" }, { value: "0", label: "Takes amounts" }] },
      rowLabel: (r) => r.code,
    };
  }, [parents.data]);
  return <ResourceManager config={config} />;
}

/* ── Fiscal years ───────────────────────────────────────────────────────── */

const FY_ACTIONS: Record<FiscalYearTransition, { label: string; from: FiscalYearStatus; confirm: string }> = {
  close: { label: "Close", from: "open", confirm: "Closing freezes the year's appropriations and allotments. You can reopen it later." },
  reopen: { label: "Reopen", from: "closed", confirm: "Reopening lets the year's appropriations and allotments change again." },
  lock: { label: "Lock", from: "closed", confirm: "Locking is permanent: a locked year can never be reopened or edited." },
};

export function FiscalYearsView() {
  const notify = useNotify();
  const canManage = useCan("fiscal_years.manage");
  const [transition] = useTransitionFiscalYearMutation();
  const [pending, setPending] = useState<{ row: FiscalYearRecord; action: FiscalYearTransition } | null>(null);

  const config = useMemo<ResourceConfig<FiscalYearRecord, FiscalYearQuery>>(
    () => ({
      title: "Fiscal Years",
      description: "Each year's budget period. Appropriations and allotments change only while their year is open.",
      singular: "fiscal year",
      permissions: { view: "fiscal_years.view", manage: "fiscal_years.manage" },
      useList: useGetFiscalYearsQuery,
      useCreate: loose(useCreateFiscalYearMutation),
      useUpdate: loose(useUpdateFiscalYearMutation),
      useDelete: loose(useDeleteFiscalYearMutation),
      useGet: useGetFiscalYearQuery,
      columns: [
        { key: "name", header: "Fiscal Year", cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: "start", header: "Start", cell: (r) => formatDate(r.start_date) },
        { key: "end", header: "End", cell: (r) => formatDate(r.end_date) },
        { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status.charAt(0).toUpperCase() + r.status.slice(1)} /> },
      ],
      fields: [
        { name: "year", label: "Year", type: "number", required: true, min: 1900, max: 2999 },
        { name: "start_date", label: "Start date", type: "date", hint: "Defaults to January 1." },
        { name: "end_date", label: "End date", type: "date", hint: "Defaults to December 31." },
      ],
      toForm: (r) => ({ year: String(r.year), start_date: r.start_date, end_date: r.end_date }),
      toInput: (values, mode, original) => {
        const out: Record<string, unknown> = {};
        const year = String(values.year ?? "").trim();
        if (mode === "create" || year !== String(original?.year)) out.year = Number(year);
        for (const key of ["start_date", "end_date"] as const) {
          const v = String(values[key] ?? "");
          if (mode === "create" ? v : v && v !== original?.[key]) out[key] = v;
        }
        return out;
      },
      buildQuery: ({ page, per_page, filter }) => ({ page, per_page, status: (filter || undefined) as FiscalYearStatus | undefined }),
      extraFilter: {
        label: "Status",
        options: [
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
          { value: "locked", label: "Locked" },
        ],
      },
      canEdit: (r) => r.status === "open",
      canDelete: (r) => r.status === "open",
      rowLabel: (r) => r.name,
      rowActions: (row) =>
        canManage
          ? (Object.keys(FY_ACTIONS) as FiscalYearTransition[])
              .filter((a) => FY_ACTIONS[a].from === row.status)
              .map((action) => ({
                label: FY_ACTIONS[action].label,
                icon: action === "lock" ? Lock : action === "reopen" ? RotateCcw : LockOpen,
                danger: action === "lock",
                onSelect: () => setPending({ row, action }),
              }))
          : [],
    }),
    [canManage],
  );

  return (
    <>
      <ResourceManager config={config} />
      <PromptDialog
        open={!!pending}
        title={pending ? `${FY_ACTIONS[pending.action].label} ${pending.row.name}?` : ""}
        description={pending ? FY_ACTIONS[pending.action].confirm : undefined}
        confirmLabel={pending ? FY_ACTIONS[pending.action].label : ""}
        danger={pending?.action === "lock"}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          const fy = await transition({ id: pending.row.id, action: pending.action }).unwrap();
          notify("success", `${fy.name} is now ${fy.status}`);
        }}
      />
    </>
  );
}
