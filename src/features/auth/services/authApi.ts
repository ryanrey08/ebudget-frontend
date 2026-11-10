import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { authService } from "@/services/auth.service";
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
      queryFn: (body) => fromService(() => authService.login(body)),
      invalidatesTags: ["Auth", "Profile"],
    }),
    logout: build.mutation<MessageResponse, void>({
      queryFn: () => fromService(() => authService.logout()),
    }),
    register: build.mutation<MessageResponse, RegisterRequest>({
      queryFn: (body) => fromService(() => authService.register(body)),
    }),
    getCurrentUser: build.query<User, void>({
      queryFn: () => fromService(() => authService.me()),
      providesTags: ["Auth"],
    }),
    forgotPassword: build.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      queryFn: (body) => fromService(() => authService.forgotPassword(body)),
    }),
    resetPassword: build.mutation<MessageResponse, ResetPasswordRequest>({
      queryFn: (body) => fromService(() => authService.resetPassword(body)),
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
