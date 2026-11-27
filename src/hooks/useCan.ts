import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { hasPermission } from "@/features/auth/utils";
import type { Permission } from "@/features/auth/types";

/**
 * UI-only permission check against GET /auth/me `permissions` (super admins
 * hold every permission). It only shows or hides actions: the backend still
 * authorises every request and answers 403 otherwise.
 */
export function useCan(permission: Permission): boolean {
  const user = useAppSelector(selectCurrentUser);
  return hasPermission(user, permission);
}
