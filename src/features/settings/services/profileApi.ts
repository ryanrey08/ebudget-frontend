import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse } from "@/types/api";
import type { User } from "@/features/auth/types";

export type UpdateProfileRequest = Pick<User, "firstName" | "lastName" | "email" | "phone" | "position" | "office">;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const profileApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProfile: build.query<User, void>({
      query: () => ENDPOINTS.profile.me,
      providesTags: ["Profile"],
    }),
    updateProfile: build.mutation<User, UpdateProfileRequest>({
      query: (body) => ({ url: ENDPOINTS.profile.me, method: "PATCH", body }),
      invalidatesTags: ["Profile", "Auth"],
    }),
    changePassword: build.mutation<MessageResponse, ChangePasswordRequest>({
      query: (body) => ({ url: ENDPOINTS.profile.changePassword, method: "POST", body }),
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation, useChangePasswordMutation } = profileApi;
