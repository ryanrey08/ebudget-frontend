/**
 * Users, roles and the permission catalog shared by every system
 * (SystemUserResource, RoleResource, SystemRoleController::permissions).
 */
import type { BackendPageQuery, IsoDateTime, Ulid } from "@/types/backend";
import type { BuiltInRoleKey, Permission, UserRoleRef } from "@/features/auth/types";

export interface SystemUser {
  id: Ulid;
  name: string;
  email: string;
  is_active: boolean;
  system: { key: "ebudget" | "engas" | "sims"; name: string };
  roles: UserRoleRef[];
  last_login_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

/** POST /users answers the user plus a one-time password (shown only once). */
export interface CreatedUser {
  user: SystemUser;
  temporaryPassword: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role_ids?: Ulid[];
}

export interface Role {
  id: Ulid;
  /** Set only on the built-in roles. */
  key: BuiltInRoleKey | null;
  name: string;
  description: string | null;
  built_in: boolean;
  permissions: Permission[];
  users_count: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RoleInput {
  name?: string;
  description?: string | null;
  permissions?: Permission[];
}

export interface PermissionDefinition {
  key: Permission;
  description: string;
}

export type AccessPageQuery = BackendPageQuery;
