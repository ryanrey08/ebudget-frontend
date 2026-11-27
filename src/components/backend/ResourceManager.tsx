"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DropdownMenu, type MenuItem } from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { PromptDialog } from "@/components/backend/PromptDialog";
import { useCan } from "@/hooks/useCan";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import type { Permission } from "@/features/auth/types";
import type { ApiError, Paginated } from "@/types/api";

/** One editable field. Its `name` is the backend field, so 422 errors land on it. */
export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "checkbox" | "select";
  /** Required when creating (the backend's rule; PATCH fields are optional). */
  required?: boolean;
  max?: number;
  min?: number;
  options?: SelectOption[];
  placeholder?: string;
  hint?: string;
  /** Can't be changed after creation. */
  createOnly?: boolean;
  /** Empty sends null (clears the value) instead of being left out. */
  nullable?: boolean;
  /** Full row width in the form grid. */
  wide?: boolean;
}

type FormValues = Record<string, string | boolean>;

interface QueryResult<T> {
  data?: Paginated<T>;
  currentData?: Paginated<T>;
  isFetching: boolean;
  error?: unknown;
  refetch: () => unknown;
}
type Mutation<A, R = unknown> = () => readonly [(arg: A) => { unwrap: () => Promise<R> }, { isLoading: boolean }];

export interface ResourceConfig<T extends { id: string | number }, Q extends object> {
  title: string;
  description: string;
  /** e.g. "fund source" */
  singular: string;
  permissions: { view: Permission; manage: Permission };
  useList: (query: Q) => QueryResult<T>;
  useCreate: Mutation<Record<string, unknown>>;
  useUpdate: Mutation<{ id: T["id"]; input: Record<string, unknown> }>;
  useDelete: Mutation<T["id"]>;
  /** GET one record: the edit form loads the latest copy before editing. */
  useGet?: (id: T["id"]) => { data?: T; isFetching: boolean; error?: unknown; refetch: () => unknown };
  columns: Column<T>[];
  fields: FieldDef[];
  /** Values the edit form starts with. */
  toForm: (row: T) => FormValues;
  /** Builds the list query from the page's filters. */
  buildQuery: (state: { page: number; per_page: number; search: string; active: "" | "1" | "0"; filter: string }) => Q;
  search?: { placeholder: string };
  /** Shows the Active / Inactive filter. */
  activeFilter?: boolean;
  /** One extra select filter, e.g. the registry code. */
  extraFilter?: { label: string; options: SelectOption[] };
  /** Label of a row in confirmations, e.g. its code. */
  rowLabel: (row: T) => string;
  /** Extra row actions (shown to managers). */
  rowActions?: (row: T, helpers: { notify: ReturnType<typeof useNotify> }) => (MenuItem & { icon?: LucideIcon })[];
  /** Whether the row can be edited or deleted (e.g. only open fiscal years). */
  canEdit?: (row: T) => boolean;
  canDelete?: (row: T) => boolean;
  /** Content shown above the table (e.g. the PREXC breadcrumb). */
  above?: ReactNode;
  /** Converts form values to the request body; defaults to the generic conversion. */
  toInput?: (values: FormValues, mode: "create" | "edit", original?: T) => Record<string, unknown>;
  /** Initial values of the create form. */
  createDefaults?: FormValues;
}

const emptyValue = (f: FieldDef) => (f.type === "checkbox" ? f.name === "is_active" : "");

/** Generic conversion: numbers, nulls, and only changed fields on edit (partial PATCH). */
export function formToInput(fields: FieldDef[], values: FormValues, mode: "create" | "edit", initial?: FormValues) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (mode === "edit" && f.createOnly) continue;
    const v = values[f.name];
    if (mode === "edit" && initial && v === initial[f.name]) continue;
    if (f.type === "checkbox") out[f.name] = Boolean(v);
    else if (typeof v === "string" && v.trim() === "") {
      if (f.nullable) out[f.name] = null;
      else if (mode === "edit" && f.required) out[f.name] = ""; // let the backend say it can't be blank
    } else if (f.type === "number") out[f.name] = Number(v);
    else out[f.name] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

export function ResourceManager<T extends { id: string | number }, Q extends object>({ config }: { config: ResourceConfig<T, Q> }) {
  return (
    <>
      <PageHeader title={config.title} description={config.description} />
      <BackendRequired>
        <ResourceTable config={config} />
      </BackendRequired>
    </>
  );
}

function ResourceTable<T extends { id: string | number }, Q extends object>({ config }: { config: ResourceConfig<T, Q> }) {
  const notify = useNotify();
  const canManage = useCan(config.permissions.manage);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft.trim(), 300);
  const [active, setActive] = useState<"" | "1" | "0">("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; row?: T } | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  useEffect(() => setPage(1), [search, active, filter, perPage]);

  const list = config.useList(config.buildQuery({ page, per_page: perPage, search, active, filter }));
  const [remove] = config.useDelete();

  const columns = useMemo<Column<T>[]>(() => {
    if (!canManage && !config.rowActions) return config.columns;
    return [
      ...config.columns,
      {
        key: "actions",
        header: "Actions",
        align: "center",
        cell: (row) => {
          const extra = config.rowActions?.(row, { notify }) ?? [];
          const items: MenuItem[] = canManage
            ? [
                { label: "Edit", icon: Pencil, onSelect: () => setEditing({ mode: "edit", row }), disabled: config.canEdit ? !config.canEdit(row) : false },
                ...extra,
                { label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(row), disabled: config.canDelete ? !config.canDelete(row) : false },
              ]
            : extra;
          if (!items.length) return null;
          return (
            <DropdownMenu
              label={`Actions for ${config.rowLabel(row)}`}
              triggerClassName="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
              trigger={<MoreHorizontal className="size-4" />}
              items={items}
            />
          );
        },
      },
    ];
  }, [canManage, config, notify]);

  return (
    <>
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {config.search && (
            <div className="min-w-56 flex-1">
              <label htmlFor="resource-search" className="mb-1.5 block text-sm font-medium text-gray-700">
                Search
              </label>
              <Input
                id="resource-search"
                type="search"
                maxLength={100}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={config.search.placeholder}
                leftIcon={<Search className="size-4" />}
              />
            </div>
          )}
          {config.extraFilter && (
            <div className="w-48">
              <label htmlFor="resource-filter" className="mb-1.5 block text-sm font-medium text-gray-700">
                {config.extraFilter.label}
              </label>
              <Select id="resource-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="All" options={config.extraFilter.options} />
            </div>
          )}
          {config.activeFilter && (
            <div className="w-40">
              <label htmlFor="resource-active" className="mb-1.5 block text-sm font-medium text-gray-700">
                Status
              </label>
              <Select
                id="resource-active"
                value={active}
                onChange={(e) => setActive(e.target.value as "" | "1" | "0")}
                placeholder="All"
                options={[
                  { value: "1", label: "Active" },
                  { value: "0", label: "Inactive" },
                ]}
              />
            </div>
          )}
          {canManage && (
            <Button className="ml-auto" onClick={() => setEditing({ mode: "create" })}>
              <Plus className="size-4" /> Add {config.singular}
            </Button>
          )}
        </div>
      </Card>

      {config.above}

      <Card className="overflow-hidden">
        <DataTable
          dense
          columns={columns}
          rows={list.data?.items}
          rowKey={(r) => String(r.id)}
          loading={list.isFetching && !list.currentData}
          error={list.error}
          onRetry={() => list.refetch()}
          emptyTitle={`No ${config.singular} records`}
          emptyDescription={canManage ? `Add the first ${config.singular}, or change the filters.` : "Change the filters, or ask an administrator to add records."}
          caption={config.title}
        />
        {list.data && list.data.total > 0 && (
          <div className="border-t border-gray-100">
            <Pagination
              page={list.data.page}
              pageSize={list.data.pageSize}
              total={list.data.total}
              onPageChange={setPage}
              pageSizeOptions={[15, 30, 50, 100]}
              onPageSizeChange={setPerPage}
            />
          </div>
        )}
      </Card>

      {editing?.mode === "edit" && editing.row && config.useGet && (
        <FreshResourceForm config={config} row={editing.row} onClose={() => setEditing(null)} onSaved={(verb) => notify("success", `${capitalize(config.singular)} ${verb}`)} />
      )}
      {editing && !(editing.mode === "edit" && config.useGet) && (
        <ResourceForm
          config={config}
          mode={editing.mode}
          row={editing.row}
          onClose={() => setEditing(null)}
          onSaved={(verb) => notify("success", `${capitalize(config.singular)} ${verb}`)}
        />
      )}

      <PromptDialog
        open={!!deleting}
        title={`Delete ${config.singular}?`}
        description={deleting ? `${config.rowLabel(deleting)} will be removed. Records that use it can't be deleted; deactivate it instead.` : undefined}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await remove(deleting.id).unwrap();
          notify("success", `${capitalize(config.singular)} deleted`);
        }}
      />
    </>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Loads the record with GET /{id} before showing the edit form. */
function FreshResourceForm<T extends { id: string | number }, Q extends object>({
  config,
  row,
  onClose,
  onSaved,
}: {
  config: ResourceConfig<T, Q>;
  row: T;
  onClose: () => void;
  onSaved: (verb: string) => void;
}) {
  const fresh = config.useGet!(row.id);
  if (fresh.error) {
    return (
      <Modal open onClose={onClose} title={`Edit ${config.singular}`} footer={<Button onClick={onClose}>Close</Button>}>
        <FormAlert>{getErrorMessage(fresh.error)}</FormAlert>
      </Modal>
    );
  }
  if (!fresh.data) {
    return (
      <Modal open onClose={onClose} title={`Edit ${config.singular}`}>
        <p className="py-6 text-center text-sm text-gray-500">Loading the latest record…</p>
      </Modal>
    );
  }
  return <ResourceForm config={config} mode="edit" row={fresh.data} onClose={onClose} onSaved={onSaved} />;
}

function ResourceForm<T extends { id: string | number }, Q extends object>({
  config,
  mode,
  row,
  onClose,
  onSaved,
}: {
  config: ResourceConfig<T, Q>;
  mode: "create" | "edit";
  row?: T;
  onClose: () => void;
  onSaved: (verb: string) => void;
}) {
  const initial = useMemo<FormValues>(() => {
    if (row) return config.toForm(row);
    return { ...Object.fromEntries(config.fields.map((f) => [f.name, emptyValue(f)])), ...config.createDefaults };
  }, [config, row]);
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<ApiError | null>(null);
  const [create, createState] = config.useCreate();
  const [update, updateState] = config.useUpdate();
  const busy = createState.isLoading || updateState.isLoading;

  const set = (name: string, value: string | boolean) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors(({ [name]: _drop, ...rest }) => rest);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: Record<string, string> = {};
    for (const f of config.fields) {
      const v = values[f.name];
      if (mode === "create" && f.required && f.type !== "checkbox" && (typeof v !== "string" || !v.trim())) missing[f.name] = `${f.label} is required.`;
      if (typeof v === "string" && f.max && f.type !== "number" && v.trim().length > f.max) missing[f.name] = `${f.label} may have at most ${f.max} characters.`;
    }
    if (Object.keys(missing).length) return setErrors(missing);

    const input = config.toInput ? config.toInput(values, mode, row) : formToInput(config.fields, values, mode, initial);
    setGeneral(null);
    try {
      if (mode === "create") await create(input).unwrap();
      else if (row) {
        if (!Object.keys(input).length) return onClose();
        await update({ id: row.id, input }).unwrap();
      }
      onSaved(mode === "create" ? "added" : "updated");
      onClose();
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) {
        setErrors(err.fieldErrors);
        const known = new Set(config.fields.map((f) => f.name));
        if (Object.keys(err.fieldErrors).some((k) => !known.has(k))) setGeneral(err);
      } else setGeneral(isApiError(err) ? err : { status: "CUSTOM_ERROR", message: getErrorMessage(err) });
    }
  };

  const fields = config.fields.filter((f) => !(mode === "edit" && f.createOnly));

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={mode === "create" ? `Add ${config.singular}` : `Edit ${config.singular}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="resource-form" loading={busy}>
            {mode === "create" ? "Save" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="resource-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {general && (
          <div className="sm:col-span-2">
            <FormAlert>{general.message}</FormAlert>
          </div>
        )}
        {fields.map((f) => {
          const id = `field-${f.name}`;
          const err = errors[f.name];
          const v = values[f.name];
          if (f.type === "checkbox") {
            return (
              <label key={f.name} className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                <input type="checkbox" className="size-4 accent-brand-600" checked={Boolean(v)} onChange={(e) => set(f.name, e.target.checked)} />
                {f.label}
                {f.hint && <span className="text-xs text-gray-500">({f.hint})</span>}
                {err && <span className="text-xs text-red-600">{err}</span>}
              </label>
            );
          }
          return (
            <FormField key={f.name} label={f.label} htmlFor={id} error={err} hint={f.hint} required={mode === "create" && f.required} className={f.wide || f.type === "textarea" ? "sm:col-span-2" : undefined}>
              {f.type === "select" ? (
                <Select id={id} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder ?? "Select…"} options={f.options ?? []} invalid={!!err} />
              ) : f.type === "textarea" ? (
                <Textarea id={id} rows={3} maxLength={f.max} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} invalid={!!err} />
              ) : (
                <Input
                  id={id}
                  type={f.type}
                  min={f.min}
                  maxLength={f.type === "text" ? f.max : undefined}
                  max={f.type === "number" ? f.max : undefined}
                  placeholder={f.placeholder}
                  value={String(v ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  invalid={!!err}
                />
              )}
            </FormField>
          );
        })}
      </form>
    </Modal>
  );
}
