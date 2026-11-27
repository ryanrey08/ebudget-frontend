import { isMockAuth } from "@/config/api.config";
import { apiClient } from "@/lib/api/api-client";
import { ApiRequestError } from "@/lib/api/api-error";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse } from "@/types/api";
import type { StaffProfile } from "@/features/settings/types";
import type { AppNotification } from "@/features/notifications/types";
import type { ChangePasswordRequest, UpdateProfileRequest } from "@/features/settings/types";

/** Settings: the signed-in user's profile and password. */
export const settingsService = {
  getProfile: () => apiClient.get<StaffProfile>(ENDPOINTS.profile.me),
  updateProfile: (payload: UpdateProfileRequest) => apiClient.patch<StaffProfile>(ENDPOINTS.profile.me, payload),
  /**
   * Real auth: PUT /auth/password (backend SystemAuthController::updatePassword,
   * through the auth proxy). 204; the backend's field names are mapped back to
   * the form's. Mock auth: the demo profile endpoint.
   */
  changePassword: async (payload: ChangePasswordRequest): Promise<MessageResponse> => {
    if (isMockAuth()) {
      return apiClient.post<MessageResponse>(ENDPOINTS.profile.changePassword, {
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
      });
    }
    try {
      await apiClient.put<null>(ENDPOINTS.auth.password, {
        current_password: payload.currentPassword,
        password: payload.newPassword,
        password_confirmation: payload.confirmPassword,
      });
      return { message: "Your password was changed. Your other sessions were signed out." };
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        const names: Record<string, string> = { current_password: "currentPassword", password: "newPassword", password_confirmation: "confirmPassword" };
        const mapped = Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [names[k] ?? k, v]));
        throw new ApiRequestError(error.status, error.message, mapped, error.problemCode);
      }
      throw error;
    }
  },
};

/** In-app notifications shown in the header. */
export const notificationsService = {
  getAll: () => apiClient.get<AppNotification[]>(ENDPOINTS.notifications.list),
  markRead: (id: string) => apiClient.patch<MessageResponse>(ENDPOINTS.notifications.read(id)),
  markAllRead: () => apiClient.post<MessageResponse>(ENDPOINTS.notifications.readAll),
};
