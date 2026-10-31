export type UserRole = "budget_officer" | "budget_head" | "accountant" | "head_of_agency" | "administrator";

export interface User {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  office: string;
  agency: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember: boolean;
}

/**
 * The session token is expected to arrive as an httpOnly cookie set by the
 * backend, so it is intentionally not part of the response body.
 */
export interface AuthResponse {
  user: User;
  expiresAt: string;
}

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

export const ROLE_LABELS: Record<UserRole, string> = {
  budget_officer: "Budget Officer",
  budget_head: "Budget Head",
  accountant: "Accountant",
  head_of_agency: "Head of Agency",
  administrator: "System Administrator",
};
