"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Textarea } from "@/components/ui/Textarea";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { PromptDialog } from "@/components/backend/PromptDialog";
import { useCan } from "@/hooks/useCan";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import type { Permission } from "@/features/auth/types";
import { useCreateRoleMutation, useDeleteRoleMutation, useGetPermissionCatalogQuery, useGetRoleQuery, useGetRolesQuery, useUpdateRoleMutation } from "../services/accessApi";
import type { PermissionDefinition, Role } from "../types";

export function RolesView() {
  return (
    <>
      <PageHeader title="Roles & Permissions" description="Roles bundle permissions; users get permissions through their roles." />
      <BackendRequired>
        <RolesTable />
      </BackendRequired>
    </>
  );
}

function RolesTable() {
  const notify = useNotify();
  const canManage = useCan("roles.manage");
  const [page, setPage] = useState(1);
  const list = useGetRolesQuery({ page, per_page: 15 });
  const [remove] = useDeleteRoleMutation();
  const [editing, setEditing] = useState<{ role?: Role } | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const columns: Column<Role>[] = [
    {
      key: "name",
      header: "Role",
      cell: (r) => (
        <span>
          <span className="font-medium text-gray-900">{r.name}</span>
          {r.built_in && (
            <span className="ml-2">
              <Badge tone="purple">Built-in</Badge>
            </span>
          )}
          {r.description && <span className="block text-xs text-gray-500">{r.description}</span>}
        </span>
      ),
    },
    { key: "perms", header: "Permissions", align: "center", cell: (r) => (r.key === "super_admin" ? "All" : r.permissions.length) },
    { key: "users", header: "Users", align: "center", cell: (r) => r.users_count },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      cell: (r) =>
        canManage ? (
          <DropdownMenu
            label={`Actions for ${r.name}`}
            triggerClassName="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
            trigger={<MoreHorizontal className="size-4" />}
            items={[
              { label: r.built_in ? "View permissions" : "Edit", icon: Pencil, onSelect: () => setEditing({ role: r }) },
              { label: "Delete", icon: Trash2, danger: true, disabled: r.built_in || r.users_count > 0, onSelect: () => setDeleting(r) },
            ]}
          />
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing({ role: r })}>
            View
          </Button>
        ),
    },
  ];

  return (
    <>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> Add role
          </Button>
        </div>
      )}
      <Card className="overflow-hidden">
        <DataTable dense columns={columns} rows={list.data?.items} rowKey={(r) => r.id} loading={list.isFetching && !list.currentData} error={list.error} onRetry={list.refetch} emptyTitle="No roles" caption="Roles" />
        {list.data && list.data.total > list.data.pageSize && (
          <div className="border-t border-gray-100">
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} />
          </div>
        )}
      </Card>
      {editing && (editing.role ? <FreshRoleModal id={editing.role.id} canManage={canManage} onClose={() => setEditing(null)} /> : <RoleModal readOnly={!canManage} onClose={() => setEditing(null)} />)}
      <PromptDialog
        open={!!deleting}
        title={`Delete the ${deleting?.name} role?`}
        description="A role that users still hold can't be deleted."
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await remove(deleting.id).unwrap();
          notify("success", "Role deleted", deleting.name);
        }}
      />
    </>
  );
}

/** Groups permission keys by their prefix ("fiscal_years.view" → "fiscal_years"). */
function groupCatalog(catalog: PermissionDefinition[]) {
  const groups = new Map<string, PermissionDefinition[]>();
  for (const p of catalog) {
    const group = p.key.split(".")[0];
    groups.set(group, [...(groups.get(group) ?? []), p]);
  }
  return [...groups.entries()];
}

const groupLabel = (g: string) => g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** GET /roles/{id} first, so the permission list is the latest. */
function FreshRoleModal({ id, canManage, onClose }: { id: string; canManage: boolean; onClose: () => void }) {
  const role = useGetRoleQuery(id);
  if (!role.data) {
    return (
      <Modal open onClose={onClose} title="Role" footer={<Button onClick={onClose}>Close</Button>}>
        {role.error ? <FormAlert>{getErrorMessage(role.error)}</FormAlert> : <p className="py-6 text-center text-sm text-gray-500">Loading…</p>}
      </Modal>
    );
  }
  return <RoleModal role={role.data} readOnly={!canManage || role.data.built_in} onClose={onClose} />;
}

function RoleModal({ role, readOnly, onClose }: { role?: Role; readOnly: boolean; onClose: () => void }) {
  const notify = useNotify();
  const catalog = useGetPermissionCatalogQuery();
  const [create, createState] = useCreateRoleMutation();
  const [update, updateState] = useUpdateRoleMutation();
  const busy = createState.isLoading || updateState.isLoading;
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const groups = useMemo(() => groupCatalog(catalog.data ?? []), [catalog.data]);
  const all = role?.key === "super_admin";

  const toggle = (key: Permission) =>
    setPerms((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = async () => {
    if (!name.trim()) return setErrors({ name: "Enter the role's name." });
    setGeneral("");
    const input = { name: name.trim(), description: description.trim() || null, permissions: [...perms] };
    try {
      if (role) await update({ id: role.id, input }).unwrap();
      else await create(input).unwrap();
      notify("success", role ? "Role updated" : "Role created", input.name);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      setGeneral(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      size="xl"
      onClose={busy ? () => undefined : onClose}
      title={role ? role.name : "Add role"}
      description={role?.built_in ? "Built-in roles can't be edited or deleted." : "You can only grant permissions you hold yourself."}
      footer={
        readOnly ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {role ? "Save changes" : "Create role"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {general && <FormAlert>{general}</FormAlert>}
        {!readOnly && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="role-name" error={errors.name} required>
              <Input id="role-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
            </FormField>
            <FormField label="Description" htmlFor="role-description" error={errors.description} className="sm:col-span-2">
              <Textarea id="role-description" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
          </div>
        )}
        {errors.permissions && <p className="text-xs text-red-600">{errors.permissions}</p>}
        {all && <FormAlert tone="info">Super admin holds every permission, including ones added later.</FormAlert>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(([group, items]) => (
            <fieldset key={group} className="rounded-lg border border-gray-200 p-3">
              <legend className="px-1 text-xs font-semibold text-gray-500 uppercase">{groupLabel(group)}</legend>
              {items.map((p) => (
                <label key={p.key} className="flex items-start gap-2 py-1 text-sm text-gray-700">
                  <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" disabled={readOnly} checked={all || perms.has(p.key)} onChange={() => toggle(p.key)} />
                  <span>
                    <span className="font-mono text-xs">{p.key}</span>
                    <span className="block text-xs text-gray-500">{p.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        {catalog.error ? <FormAlert>{getErrorMessage(catalog.error)}</FormAlert> : null}
      </div>
    </Modal>
  );
}
