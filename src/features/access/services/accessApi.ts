import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { accessService, reportSharingService } from "@/services/backend";
import type { Paginated } from "@/types/api";
import type { AccessPageQuery, CreateUserInput, CreatedUser, PermissionDefinition, Role, RoleInput, SystemUser } from "../types";

const USERS = { type: "User" as const, id: "LIST" };
const ROLES = { type: "Role" as const, id: "LIST" };

export const accessApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPermissionCatalog: build.query<PermissionDefinition[], void>({
      queryFn: () => fromService(() => accessService.permissions()),
      keepUnusedDataFor: 3600,
    }),
    getRoles: build.query<Paginated<Role>, AccessPageQuery>({
      queryFn: (q) => fromService(() => accessService.roles(q)),
      providesTags: (result) => [ROLES, ...(result?.items.map((r) => ({ type: "Role" as const, id: r.id })) ?? [])],
    }),
    getRole: build.query<Role, string>({
      queryFn: (id) => fromService(() => accessService.role(id)),
      providesTags: (_r, _e, id) => [{ type: "Role", id }],
    }),
    createRole: build.mutation<Role, RoleInput>({
      queryFn: (input) => fromService(() => accessService.createRole(input)),
      invalidatesTags: [ROLES],
    }),
    updateRole: build.mutation<Role, { id: string; input: RoleInput }>({
      queryFn: ({ id, input }) => fromService(() => accessService.updateRole(id, input)),
      // Users' effective permissions change with their roles.
      invalidatesTags: (_r, _e, { id }) => [ROLES, { type: "Role", id }, USERS, "Auth"],
    }),
    deleteRole: build.mutation<null, string>({
      queryFn: (id) => fromService(() => accessService.deleteRole(id)),
      invalidatesTags: [ROLES],
    }),

    getUsers: build.query<Paginated<SystemUser>, AccessPageQuery>({
      queryFn: (q) => fromService(() => accessService.users(q)),
      providesTags: (result) => [USERS, ...(result?.items.map((u) => ({ type: "User" as const, id: u.id })) ?? [])],
    }),
    getUser: build.query<SystemUser, string>({
      queryFn: (id) => fromService(() => accessService.user(id)),
      providesTags: (_r, _e, id) => [{ type: "User", id }],
    }),
    createUser: build.mutation<CreatedUser, CreateUserInput>({
      queryFn: (input) => fromService(() => accessService.createUser(input)),
      invalidatesTags: [USERS, ROLES],
    }),
    syncUserRoles: build.mutation<SystemUser, { id: string; roleIds: string[] }>({
      queryFn: ({ id, roleIds }) => fromService(() => accessService.syncRoles(id, roleIds)),
      invalidatesTags: (_r, _e, { id }) => [USERS, { type: "User", id }, ROLES, "Auth"],
    }),
    setUserActive: build.mutation<SystemUser, { id: string; active: boolean }>({
      queryFn: ({ id, active }) => fromService(() => (active ? accessService.activate(id) : accessService.deactivate(id))),
      invalidatesTags: (_r, _e, { id }) => [USERS, { type: "User", id }],
    }),

    getReportDatasets: build.query<Awaited<ReturnType<typeof reportSharingService.datasets>>, void>({
      queryFn: () => fromService(() => reportSharingService.datasets()),
      providesTags: ["ReportShare"],
    }),
    getReportShares: build.query<Awaited<ReturnType<typeof reportSharingService.shares>>, void>({
      queryFn: () => fromService(() => reportSharingService.shares()),
      providesTags: ["ReportShare"],
    }),
    shareReportDataset: build.mutation<unknown, { dataset: string; system: string }>({
      queryFn: ({ dataset, system }) => fromService(() => reportSharingService.share(dataset, system)),
      invalidatesTags: ["ReportShare"],
    }),
    unshareReportDataset: build.mutation<null, number>({
      queryFn: (id) => fromService(() => reportSharingService.unshare(id)),
      invalidatesTags: ["ReportShare"],
    }),
  }),
});

export const {
  useGetPermissionCatalogQuery,
  useGetRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useSyncUserRolesMutation,
  useSetUserActiveMutation,
  useGetReportDatasetsQuery,
  useGetReportSharesQuery,
  useShareReportDatasetMutation,
  useUnshareReportDatasetMutation,
} = accessApi;
