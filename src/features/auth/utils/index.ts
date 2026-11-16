import type { Permission, User } from "../types";

/** Display label for the user's roles, e.g. "Super admin" or "Admin, Budget Officer". */
export function roleLabel(user: Pick<User, "roles" | "is_super_admin">): string {
  const names = user.roles.map((r) => r.name).filter(Boolean);
  if (names.length) return names.join(", ");
  return user.is_super_admin ? "Super admin" : "No role assigned";
}

/**
 * UI-only permission check (show/hide actions and navigation). The backend
 * authorises every request itself; never rely on this for security.
 */
export function hasPermission(user: Pick<User, "permissions" | "is_super_admin"> | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return user.is_super_admin || user.permissions.includes(permission);
}
