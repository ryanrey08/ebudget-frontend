import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse } from "@/types/api";
import type {
  AuthResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  User,
} from "../types";

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: ENDPOINTS.auth.login, method: "POST", body }),
      invalidatesTags: ["Auth", "Profile"],
    }),
    logout: build.mutation<MessageResponse, void>({
      query: () => ({ url: ENDPOINTS.auth.logout, method: "POST" }),
    }),
    register: build.mutation<MessageResponse, RegisterRequest>({
      query: (body) => ({ url: ENDPOINTS.auth.register, method: "POST", body }),
    }),
    getCurrentUser: build.query<User, void>({
      query: () => ENDPOINTS.auth.me,
      providesTags: ["Auth"],
    }),
    forgotPassword: build.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: (body) => ({ url: ENDPOINTS.auth.forgotPassword, method: "POST", body }),
    }),
    resetPassword: build.mutation<MessageResponse, ResetPasswordRequest>({
      query: (body) => ({ url: ENDPOINTS.auth.resetPassword, method: "POST", body }),
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useGetCurrentUserQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;
