/**
 * Authentication types. They mirror the backend contract exactly
 * (backend: app/Http/Resources/Api/V1/CurrentSystemUserResource.php and
 * SystemAuthController.php). See docs/AUTH_API_INTEGRATION.md.
 */

/** Permission catalog of the backend (app/Enums/Permission.php). */
export type Permission =
  | "users.view"
  | "users.create"
  | "users.deactivate"
  | "roles.view"
  | "roles.manage"
  | "roles.assign"
  | "reports.view"
  | "reports.share";

/** Built-in role keys (app/Enums/SystemRole.php). Custom roles have `key: null`. */
export type BuiltInRoleKey = "super_admin" | "admin";

export interface UserRoleRef {
  /** ULID */
  id: string;
  key: BuiltInRoleKey | null;
  name: string;
}

/** The signed-in user, as returned by `GET /auth/me` and in the login response. */
export interface User {
  /** ULID */
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  system: { key: "ebudget" | "engas" | "sims"; name: string };
  roles: UserRoleRef[];
  /** ISO 8601, null before the first login. */
  last_login_at: string | null;
  created_at: string;
  is_super_admin: boolean;
  /** Effective permissions. The backend still authorises every request itself. */
  permissions: Permission[];
}

export interface LoginRequest {
  email: string;
  password: string;
  /**
   * Frontend-only: keep the session cookie after the browser closes. The
   * backend token always lives `API_TOKEN_TTL_MINUTES` (12 h by default).
   */
  remember: boolean;
}

/**
 * What the frontend receives after signing in. The access token itself is
 * kept by the auth proxy in an httpOnly cookie and never reaches scripts.
 */
export interface AuthResponse {
  user: User;
  /** ISO 8601 expiry of the backend access token. */
  expiresAt: string;
}

/* The flows below exist only in the mock API: the backend has no register,
 * forgot-password or reset-password endpoints. */

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  office: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  /** Only returned by the mock API so the reset flow can be tested without email. */
  devResetToken?: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}
