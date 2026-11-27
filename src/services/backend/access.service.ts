import { BACKEND } from "@/lib/api/endpoints";
import type { Paginated } from "@/types/api";
import type { AccessPageQuery, CreateUserInput, CreatedUser, PermissionDefinition, Role, RoleInput, SystemUser } from "@/features/access/types";
import { backend, compact } from "./http";

/** Users, roles and permissions (shared routes in backend routes/api.php). */
export const accessService = {
  permissions: () => backend.get<PermissionDefinition[]>(BACKEND.permissions),

  roles: (query: AccessPageQuery) => backend.get<Paginated<Role>>(BACKEND.roles, compact(query)),
  role: (id: string) => backend.get<Role>(BACKEND.role(id)),
  createRole: (input: RoleInput) => backend.post<Role>(BACKEND.roles, input),
  updateRole: (id: string, input: RoleInput) => backend.patch<Role>(BACKEND.role(id), input),
  /** 409 built_in_role / role_in_use. */
  deleteRole: (id: string) => backend.delete(BACKEND.role(id)),

  users: (query: AccessPageQuery) => backend.get<Paginated<SystemUser>>(BACKEND.users, compact(query)),
  user: (id: string) => backend.get<SystemUser>(BACKEND.user(id)),
  /**
   * 201 with `{ data: user, temporary_password }` (Cache-Control: no-store).
   * The password is shown once and never kept in the cache.
   */
  createUser: async (input: CreateUserInput): Promise<CreatedUser> => {
    const raw = await backend.post<{ data: SystemUser; temporary_password: string }>(BACKEND.users, input, { rawResponse: true });
    return { user: raw.data, temporaryPassword: raw.temporary_password };
  },
  syncRoles: (id: string, roleIds: string[]) => backend.put<SystemUser>(BACKEND.userRoles(id), { role_ids: roleIds }),
  deactivate: (id: string) => backend.post<SystemUser>(BACKEND.userDeactivate(id)),
  activate: (id: string) => backend.post<SystemUser>(BACKEND.userActivate(id)),
};

export interface ReportDataset {
  key: string;
  description: string;
  source: { key: string; name: string };
  shared_with_you: boolean;
}
export interface ReportShare {
  id: number;
  dataset: string;
  system: { key: string; name: string };
  granted_by: string;
  created_at: string;
}

/** Cross-system report datasets (unchanged shared routes, reports.view / reports.share). */
export const reportSharingService = {
  datasets: () => backend.get<ReportDataset[]>(BACKEND.reportDatasets),
  shares: async () => {
    const raw = await backend.get<{ data: ReportShare[]; datasets: string[] }>(BACKEND.reportShares, undefined, { rawResponse: true });
    return { shares: raw.data, datasets: raw.datasets };
  },
  share: (dataset: string, system: string) => backend.post<ReportShare>(BACKEND.reportShares, { dataset, system }),
  unshare: (id: number) => backend.delete(BACKEND.reportShare(id)),
};
