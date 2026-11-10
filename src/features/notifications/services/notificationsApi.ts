import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { notificationsService } from "@/services/settings.service";
import type { MessageResponse } from "@/types/api";
import type { AppNotification } from "../types";

export const notificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query<AppNotification[], void>({
      queryFn: () => fromService(() => notificationsService.getAll()),
      providesTags: ["Notification"],
    }),
    markNotificationRead: build.mutation<MessageResponse, string>({
      queryFn: (id) => fromService(() => notificationsService.markRead(id)),
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
      queryFn: () => fromService(() => notificationsService.markAllRead()),
      invalidatesTags: ["Notification"],
    }),
  }),
});

export const { useGetNotificationsQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } =
  notificationsApi;
