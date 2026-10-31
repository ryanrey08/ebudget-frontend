import { ENDPOINTS } from "@/lib/api/endpoints";
import type {
  AuthResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  User,
} from "@/features/auth/types";
import type { ChangePasswordRequest, UpdateProfileRequest } from "@/features/settings/services/profileApi";
import { db } from "../services/db";
import { MockHttpError, route } from "../services/http";
import { clearMockSession, getMockSessionUserId, setMockSession } from "../services/session";

function currentRecord() {
  const userId = getMockSessionUserId();
  const record = userId ? db.users.find((u) => u.user.id === userId) : undefined;
  if (!record) throw new MockHttpError(401, "You are not signed in.");
  return record;
}

export const authHandlers = [
  route<LoginRequest>("POST", ENDPOINTS.auth.login, ({ body }): AuthResponse => {
    const record = db.users.find((u) => u.user.email.toLowerCase() === body.email.trim().toLowerCase());
    if (!record || record.password !== body.password) {
      throw new MockHttpError(401, "Invalid email or password.");
    }
    record.user.lastLoginAt = new Date().toISOString();
    const expiresAt = setMockSession(record.user.id, body.remember);
    return { user: { ...record.user }, expiresAt };
  }),

  route("POST", ENDPOINTS.auth.logout, () => {
    clearMockSession();
    return { message: "Signed out." };
  }),

  route("GET", ENDPOINTS.auth.me, (): User => ({ ...currentRecord().user })),

  route<RegisterRequest>("POST", ENDPOINTS.auth.register, ({ body }) => {
    if (db.users.some((u) => u.user.email.toLowerCase() === body.email.toLowerCase())) {
      throw new MockHttpError(422, "An account with this email already exists.", {
        email: "This email is already registered.",
      });
    }
    db.users.push({
      password: body.password,
      user: {
        id: `usr-${String(db.users.length + 1).padStart(3, "0")}`,
        employeeId: body.employeeId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: "",
        position: "Staff",
        office: body.office,
        agency: "Marikina Polytechnic College",
        role: "budget_officer",
        createdAt: new Date().toISOString(),
      },
    });
    return { message: "Account created. You can now sign in." };
  }),

  route<ForgotPasswordRequest>("POST", ENDPOINTS.auth.forgotPassword, ({ body }): ForgotPasswordResponse => {
    const record = db.users.find((u) => u.user.email.toLowerCase() === body.email.toLowerCase());
    const message = "If an account exists for this email, a password reset link has been sent.";
    if (!record) return { message };
    const token = `reset-${Math.random().toString(36).slice(2, 10)}`;
    db.resetTokens.set(token, record.user.id);
    return { message, devResetToken: token };
  }),

  route<ResetPasswordRequest>("POST", ENDPOINTS.auth.resetPassword, ({ body }) => {
    const userId = db.resetTokens.get(body.token);
    const record = db.users.find((u) => u.user.id === userId);
    if (!record) throw new MockHttpError(400, "This reset link is invalid or has expired.");
    record.password = body.password;
    db.resetTokens.delete(body.token);
    return { message: "Your password has been reset. Please sign in." };
  }),

  route("GET", ENDPOINTS.profile.me, (): User => ({ ...currentRecord().user })),

  route<UpdateProfileRequest>("PATCH", ENDPOINTS.profile.me, ({ body }): User => {
    const record = currentRecord();
    const taken = db.users.some(
      (u) => u !== record && u.user.email.toLowerCase() === body.email.toLowerCase(),
    );
    if (taken) throw new MockHttpError(422, "Email is already in use.", { email: "Email is already in use." });
    record.user = { ...record.user, ...body };
    return { ...record.user };
  }),

  route<ChangePasswordRequest>("POST", ENDPOINTS.profile.changePassword, ({ body }) => {
    const record = currentRecord();
    if (record.password !== body.currentPassword) {
      throw new MockHttpError(422, "Current password is incorrect.", {
        currentPassword: "Current password is incorrect.",
      });
    }
    record.password = body.newPassword;
    return { message: "Password updated." };
  }),
];
