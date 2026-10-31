"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectAuthStatus } from "@/store/slices/authSlice";
import { selectSidebarCollapsed } from "@/store/slices/uiSlice";
import { useGetCurrentUserQuery } from "@/features/auth/services/authApi";
import { REDIRECT_PARAM } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils/cn";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

/**
 * Authenticated application frame. Middleware already blocks requests without
 * a session cookie; this additionally resolves the current user and sends the
 * visitor back to login if the session turns out to be invalid.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAppSelector(selectAuthStatus);
  const collapsed = useAppSelector(selectSidebarCollapsed);
  useGetCurrentUserQuery();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`${ROUTES.login}?${REDIRECT_PARAM}=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-brand-600" label={status === "checking" ? "Loading eBudget…" : "Redirecting…"} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-lg bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Header />
      <Sidebar />
      <main
        id="main-content"
        className={cn(
          "pt-[72px] transition-[padding] duration-200",
          collapsed ? "lg:pl-20" : "lg:pl-[276px]",
        )}
      >
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
