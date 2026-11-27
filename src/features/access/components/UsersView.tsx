"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, MoreHorizontal, Plus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DropdownMenu, type MenuItem } from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { PromptDialog } from "@/components/backend/PromptDialog";
import { useCan } from "@/hooks/useCan";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { formatDateTime } from "@/lib/utils/format";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useCreateUserMutation, useGetRolesQuery, useGetUserQuery, useGetUsersQuery, useSetUserActiveMutation, useSyncUserRolesMutation } from "../services/accessApi";
import type { Role, SystemUser } from "../types";

/** Every role fits one page (per_page max 100). */
const ALL_ROLES = { per_page: 100 } as const;

export function UsersView() {
  return (
    <>
      <PageHeader title="Users" description="eBudget user accounts and the roles that give them permissions." />
      <BackendRequired>
        <UsersTable />
      </BackendRequired>
    </>
  );
}

function UsersTable() {
  const notify = useNotify();
  const me = useAppSelector(selectCurrentUser);
  const canCreate = useCan("users.create");
  const canAssign = useCan("roles.assign");
  const canDeactivate = useCan("users.deactivate");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const list = useGetUsersQuery({ page, per_page: perPage });
  const [setActive] = useSetUserActiveMutation();
  const [creating, setCreating] = useState(false);
  const [rolesFor, setRolesFor] = useState<SystemUser | null>(null);
  const [toggling, setToggling] = useState<SystemUser | null>(null);
  const [search, setSearch] = useState("");

  // The backend's user list takes no search: filter the current page only.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = list.data?.items;
    return q ? items?.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : items;
  }, [list.data, search]);

  const columns: Column<SystemUser>[] = [
    {
      key: "name",
      header: "Name",
      cell: (u) => (
        <span>
          <span className="font-medium text-gray-900">{u.name}</span>
          {u.id === me?.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
          <span className="block text-xs text-gray-500">{u.email}</span>
        </span>
      ),
    },
    { key: "roles", header: "Roles", cell: (u) => (u.roles.length ? u.roles.map((r) => r.name).join(", ") : <span className="text-gray-400">No role</span>) },
    { key: "last", header: "Last Login", hideBelow: "md", cell: (u) => (u.last_login_at ? formatDateTime(u.last_login_at) : "Never") },
    { key: "status", header: "Status", align: "center", cell: (u) => <StatusBadge status={u.is_active ? "Active" : "Inactive"} /> },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      cell: (u) => {
        const items: MenuItem[] = [];
        if (canAssign) items.push({ label: "Edit roles", icon: ShieldCheck, onSelect: () => setRolesFor(u) });
        if (canDeactivate)
          items.push(
            u.is_active
              ? { label: "Deactivate", icon: UserX, danger: true, disabled: u.id === me?.id, onSelect: () => setToggling(u) }
              : { label: "Activate", icon: UserCheck, onSelect: () => setToggling(u) },
          );
        return items.length ? (
          <DropdownMenu label={`Actions for ${u.name}`} triggerClassName="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-100" trigger={<MoreHorizontal className="size-4" />} items={items} />
        ) : null;
      },
    },
  ];

  return (
    <>
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor="user-search" className="mb-1.5 block text-sm font-medium text-gray-700">
              Filter this page
            </label>
            <Input id="user-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" />
          </div>
          {canCreate && (
            <Button className="ml-auto" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Add user
            </Button>
          )}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <DataTable
          dense
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          loading={list.isFetching && !list.currentData}
          error={list.error}
          onRetry={list.refetch}
          emptyTitle="No users found"
          caption="Users"
        />
        {list.data && list.data.total > 0 && (
          <div className="border-t border-gray-100">
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} pageSizeOptions={[15, 30, 50, 100]} onPageSizeChange={(n) => { setPerPage(n); setPage(1); }} />
          </div>
        )}
      </Card>

      {creating && <CreateUserModal canAssign={canAssign} onClose={() => setCreating(false)} />}
      {rolesFor && <FreshUserRolesModal id={rolesFor.id} onClose={() => setRolesFor(null)} />}
      <PromptDialog
        open={!!toggling}
        title={toggling?.is_active ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={toggling?.is_active ? "They can't sign in, and every session they have is signed out at once." : "They can sign in again with their password."}
        confirmLabel={toggling?.is_active ? "Deactivate" : "Activate"}
        danger={toggling?.is_active}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return;
          const u = await setActive({ id: toggling.id, active: !toggling.is_active }).unwrap();
          notify("success", u.is_active ? "User activated" : "User deactivated", u.name);
        }}
      />
    </>
  );
}

function RoleChecklist({ roles, selected, onToggle }: { roles: Role[]; selected: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-3">
      {roles.map((r) => (
        <label key={r.id} className="flex items-start gap-2 py-1 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} />
          <span>
            <span className="font-medium">{r.name}</span>
            {r.built_in && <span className="ml-1 text-xs text-gray-400">(built-in)</span>}
            {r.description && <span className="block text-xs text-gray-500">{r.description}</span>}
          </span>
        </label>
      ))}
      {!roles.length && <p className="text-sm text-gray-500">No roles yet.</p>}
    </div>
  );
}

const toggleIn = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

function CreateUserModal({ canAssign, onClose }: { canAssign: boolean; onClose: () => void }) {
  const notify = useNotify();
  const roles = useGetRolesQuery(ALL_ROLES, { skip: !canAssign });
  const [create, { isLoading }] = useCreateUserMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "Enter the user's name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) local.email = "Enter a valid email address.";
    if (Object.keys(local).length) return setErrors(local);
    setGeneral("");
    try {
      const res = await create({ name: name.trim(), email: email.trim(), role_ids: canAssign ? [...roleIds] : undefined }).unwrap();
      setCreated({ name: res.user.name, email: res.user.email, password: res.temporaryPassword });
      notify("success", "User created", res.user.email);
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      if (!(isApiError(err) && err.fieldErrors) || err.problemCode) setGeneral(getErrorMessage(err));
    }
  };

  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        title="User created"
        description="Give this one-time password to the user. It is shown only now and can't be retrieved later."
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-medium">{created.name}</span> ({created.email})
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <KeyRound className="size-4 text-amber-700" aria-hidden />
            <code className="flex-1 font-mono text-base break-all text-gray-900">{created.password}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(created.password).then(() => notify("info", "Password copied"))}>
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
          <p className="text-gray-500">They should change it after signing in (Settings → Profile → Change Password).</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={isLoading ? () => undefined : onClose}
      title="Add user"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" loading={isLoading}>
            Create user
          </Button>
        </>
      }
    >
      <form id="create-user" onSubmit={submit} noValidate className="space-y-4">
        {general && <FormAlert>{general}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" htmlFor="user-name" error={errors.name} required>
            <Input id="user-name" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
          </FormField>
          <FormField label="Email" htmlFor="user-email" error={errors.email} required>
            <Input id="user-email" type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
          </FormField>
        </div>
        {canAssign && (
          <FormField label="Roles" htmlFor="user-roles" error={errors.role_ids} hint="You can only give roles whose permissions you hold yourself.">
            <RoleChecklist roles={roles.data?.items ?? []} selected={roleIds} onToggle={(id) => setRoleIds((s) => toggleIn(s, id))} />
          </FormField>
        )}
      </form>
    </Modal>
  );
}

/** GET /users/{id} first, so the role list is the latest. */
function FreshUserRolesModal({ id, onClose }: { id: string; onClose: () => void }) {
  const user = useGetUserQuery(id);
  if (!user.data) {
    return (
      <Modal open onClose={onClose} title="Roles" footer={<Button onClick={onClose}>Close</Button>}>
        {user.error ? <FormAlert>{getErrorMessage(user.error)}</FormAlert> : <p className="py-6 text-center text-sm text-gray-500">Loading…</p>}
      </Modal>
    );
  }
  return <UserRolesModal user={user.data} onClose={onClose} />;
}

function UserRolesModal({ user, onClose }: { user: SystemUser; onClose: () => void }) {
  const notify = useNotify();
  const roles = useGetRolesQuery(ALL_ROLES);
  const [sync, { isLoading }] = useSyncUserRolesMutation();
  const [selected, setSelected] = useState<Set<string>>(new Set(user.roles.map((r) => r.id)));
  const [error, setError] = useState("");
  useEffect(() => setSelected(new Set(user.roles.map((r) => r.id))), [user]);

  const save = async () => {
    setError("");
    try {
      await sync({ id: user.id, roleIds: [...selected] }).unwrap();
      notify("success", "Roles updated", user.name);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={isLoading ? () => undefined : onClose}
      title={`Roles of ${user.name}`}
      description="Replaces every role the user has. Changes apply at once."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={save} loading={isLoading}>
            Save roles
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <FormAlert>{error}</FormAlert>}
        <RoleChecklist roles={roles.data?.items ?? []} selected={selected} onToggle={(id) => setSelected((s) => toggleIn(s, id))} />
      </div>
    </Modal>
  );
}
