/**
 * Staff profile used by the mock API (profile editing, approver names on
 * mock workflows). The backend has no profile endpoints yet, so in real auth
 * mode the profile page shows the authenticated user from `GET /auth/me`.
 */
export type StaffRole = "budget_officer" | "budget_head" | "accountant" | "head_of_agency" | "administrator";

export interface StaffProfile {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  office: string;
  agency: string;
  role: StaffRole;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  budget_officer: "Budget Officer",
  budget_head: "Budget Head",
  accountant: "Accountant",
  head_of_agency: "Head of Agency",
  administrator: "System Administrator",
};

export type UpdateProfileRequest = Pick<StaffProfile, "firstName" | "lastName" | "email" | "phone" | "position" | "office">;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
