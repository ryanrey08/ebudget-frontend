import { apiClient } from "@/lib/api/api-client";
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
import type { MessageResponse } from "@/types/api";

/**
 * Authentication. In real auth mode these paths are answered by the
 * same-origin auth proxy (src/app/api/auth), which calls the backend's
 * /api/v1/{system}/auth/* endpoints and keeps the bearer token in an httpOnly
 * cookie. See docs/AUTH_API_INTEGRATION.md.
 */
export const authService = {
  /** POST /auth/login → { user, expiresAt }. 422 = invalid credentials or input, 429 = throttled. */
  login: (payload: LoginRequest) => apiClient.post<AuthResponse>(ENDPOINTS.auth.login, payload, { skipAuth: true }),
  /** POST /auth/logout → 204. Revokes the current token and clears the cookie. */
  logout: () => apiClient.post<null>(ENDPOINTS.auth.logout),
  /** GET /auth/me → the signed-in user with roles and effective permissions. */
  me: () => apiClient.get<User>(ENDPOINTS.auth.me),

  // Mock API only: the backend has no register / forgot / reset endpoints.
  register: (payload: RegisterRequest) => apiClient.post<MessageResponse>(ENDPOINTS.auth.register, payload, { skipAuth: true }),
  forgotPassword: (payload: ForgotPasswordRequest) =>
    apiClient.post<ForgotPasswordResponse>(ENDPOINTS.auth.forgotPassword, payload, { skipAuth: true }),
  resetPassword: (payload: ResetPasswordRequest) =>
    apiClient.post<MessageResponse>(ENDPOINTS.auth.resetPassword, payload, { skipAuth: true }),
};
