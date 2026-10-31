"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "../services/notificationsApi";

const kindIcon = {
  info: <Info className="size-4 text-blue-600" />,
  success: <CheckCircle2 className="size-4 text-green-600" />,
  warning: <AlertTriangle className="size-4 text-amber-500" />,
};

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const { data, isLoading } = useGetNotificationsQuery();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const unread = data?.filter((n) => !n.read).length ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
      >
        <Bell className="size-6" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 flex size-[18px] items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white ring-2 ring-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="font-semibold text-gray-900">Notifications</p>
            <button
              type="button"
              onClick={() => markAll()}
              disabled={!unread || markingAll}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              <CheckCheck className="size-3.5" /> Mark all as read
            </button>
          </div>
          <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {isLoading &&
              Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </li>
              ))}
            {data?.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href ?? "#"}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    setOpen(false);
                  }}
                  className={cn("flex gap-3 px-4 py-3 hover:bg-gray-50", !n.read && "bg-brand-50/50")}
                >
                  <span className="mt-0.5">{kindIcon[n.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{n.title}</span>
                      {!n.read && <span className="size-2 rounded-full bg-brand-600" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-600">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-gray-400">{formatDateTime(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
