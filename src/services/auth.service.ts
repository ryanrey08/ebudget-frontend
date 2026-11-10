import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { clearAuthToken, setAuthToken } from "@/lib/api/auth-token";
import type { MessageResponse } from "@/types/api";
import type {
  AuthResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  User,
} from "@/features/auth/types";

/** Authentication. The session normally travels as an httpOnly cookie. */
export const authService = {
  login: async (payload: LoginRequest) => {
    const response = await apiClient.post<AuthResponse & { token?: string }>(ENDPOINTS.auth.login, payload, { skipAuth: true });
    // Token-based backends (e.g. Sanctum tokens) return the token in the body.
    if (response.token) setAuthToken(response.token);
    const { token: _token, ...rest } = response;
    void _token;
    return rest as AuthResponse;
  },
  logout: async () => {
    try {
      return await apiClient.post<MessageResponse>(ENDPOINTS.auth.logout);
    } finally {
      clearAuthToken();
    }
  },
  register: (payload: RegisterRequest) => apiClient.post<MessageResponse>(ENDPOINTS.auth.register, payload, { skipAuth: true }),
  me: () => apiClient.get<User>(ENDPOINTS.auth.me),
  forgotPassword: (payload: ForgotPasswordRequest) =>
    apiClient.post<ForgotPasswordResponse>(ENDPOINTS.auth.forgotPassword, payload, { skipAuth: true }),
  resetPassword: (payload: ResetPasswordRequest) =>
    apiClient.post<MessageResponse>(ENDPOINTS.auth.resetPassword, payload, { skipAuth: true }),
};
