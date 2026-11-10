import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse } from "@/types/api";
import type { User } from "@/features/auth/types";
import type { AppNotification } from "@/features/notifications/types";
import type { ChangePasswordRequest, UpdateProfileRequest } from "@/features/settings/types";

/** Settings: the signed-in user's profile and password. */
export const settingsService = {
  getProfile: () => apiClient.get<User>(ENDPOINTS.profile.me),
  updateProfile: (payload: UpdateProfileRequest) => apiClient.patch<User>(ENDPOINTS.profile.me, payload),
  changePassword: (payload: ChangePasswordRequest) => apiClient.post<MessageResponse>(ENDPOINTS.profile.changePassword, payload),
};

/** In-app notifications shown in the header. */
export const notificationsService = {
  getAll: () => apiClient.get<AppNotification[]>(ENDPOINTS.notifications.list),
  markRead: (id: string) => apiClient.patch<MessageResponse>(ENDPOINTS.notifications.read(id)),
  markAllRead: () => apiClient.post<MessageResponse>(ENDPOINTS.notifications.readAll),
};
