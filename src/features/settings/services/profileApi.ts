import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { settingsService } from "@/services/settings.service";
import type { MessageResponse } from "@/types/api";
import type { User } from "@/features/auth/types";
import type { ChangePasswordRequest, UpdateProfileRequest } from "../types";

export type { ChangePasswordRequest, UpdateProfileRequest } from "../types";

export const profileApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProfile: build.query<User, void>({
      queryFn: () => fromService(() => settingsService.getProfile()),
      providesTags: ["Profile"],
    }),
    updateProfile: build.mutation<User, UpdateProfileRequest>({
      queryFn: (body) => fromService(() => settingsService.updateProfile(body)),
      invalidatesTags: ["Profile", "Auth"],
    }),
    changePassword: build.mutation<MessageResponse, ChangePasswordRequest>({
      queryFn: (body) => fromService(() => settingsService.changePassword(body)),
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation, useChangePasswordMutation } = profileApi;
