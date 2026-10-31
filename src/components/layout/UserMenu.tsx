"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { ROLE_LABELS } from "@/features/auth/types";
import { ROUTES } from "@/lib/constants/routes";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/shared/Avatar";

export function UserMenu() {
  const user = useAppSelector(selectCurrentUser);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const { logout, isLoggingOut } = useLogout();

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="hidden h-8 w-28 md:block" />
      </div>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-3 rounded-lg py-1 pr-1 pl-1 hover:bg-gray-100 md:pr-2"
      >
        <Avatar name={fullName} />
        <span className="hidden text-left md:block">
          <span className="block text-sm font-medium text-gray-900">{fullName}</span>
          <span className="block text-xs text-gray-500">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown className="hidden size-4 text-gray-500 md:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{fullName}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <Link
            role="menuitem"
            href={ROUTES.profile}
            onClick={close}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <UserRound className="size-4" /> Profile settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-60"
          >
            <LogOut className="size-4" /> {isLoggingOut ? "Signing out…" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}
