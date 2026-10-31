import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { MessageResponse } from "@/types/api";
import type { AppNotification } from "../types";

export const notificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query<AppNotification[], void>({
      query: () => ENDPOINTS.notifications.list,
      providesTags: ["Notification"],
    }),
    markNotificationRead: build.mutation<MessageResponse, string>({
      query: (id) => ({ url: ENDPOINTS.notifications.read(id), method: "PATCH" }),
      // Optimistic update so the badge reacts immediately.
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationsApi.util.updateQueryData("getNotifications", undefined, (draft) => {
            const item = draft.find((n) => n.id === id);
            if (item) item.read = true;
          }),
        );
        queryFulfilled.catch(patch.undo);
      },
    }),
    markAllNotificationsRead: build.mutation<MessageResponse, void>({
      query: () => ({ url: ENDPOINTS.notifications.readAll, method: "POST" }),
      invalidatesTags: ["Notification"],
    }),
  }),
});

export const { useGetNotificationsQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } =
  notificationsApi;
