"use client";

import Link from "next/link";
import { Building2, Menu } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { openMobileSidebar, selectSidebarCollapsed, toggleSidebarCollapsed } from "@/store/slices/uiSlice";
import { agencyChanged, fiscalYearChanged, selectAgencyId, selectFiscalYear } from "@/store/slices/filtersSlice";
import { AGENCIES, FISCAL_YEARS, type AgencyId, type FiscalYear } from "@/config/site";
import { ROUTES } from "@/lib/constants/routes";
import { Select } from "@/components/ui/Select";
import { LogoLockup } from "@/components/shared/Logo";
import { NotificationsMenu } from "@/features/notifications/components/NotificationsMenu";
import { cn } from "@/lib/utils/cn";
import { UserMenu } from "./UserMenu";

export function Header() {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const fiscalYear = useAppSelector(selectFiscalYear);
  const agencyId = useAppSelector(selectAgencyId);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[72px] items-center border-b border-gray-200 bg-white">
      <div
        className={cn(
          "flex h-full items-center gap-2 pl-3 sm:pl-5 lg:shrink-0 lg:transition-[width]",
          collapsed ? "lg:w-20 lg:justify-center lg:pl-0" : "lg:w-[276px]",
        )}
      >
        <button
          type="button"
          onClick={() => dispatch(openMobileSidebar())}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
          aria-label="Open navigation"
          aria-controls="app-sidebar"
        >
          <Menu className="size-6" />
        </button>
        <Link href={ROUTES.dashboard} aria-label="eBudget dashboard" className="flex items-center">
          <LogoLockup className="hidden sm:flex lg:hidden" />
          <LogoLockup compact className="sm:hidden" />
          <LogoLockup compact={collapsed} className="hidden lg:flex" />
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 sm:px-5">
        <button
          type="button"
          onClick={() => dispatch(toggleSidebarCollapsed())}
          className="hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-controls="app-sidebar"
          aria-expanded={!collapsed}
        >
          <Menu className="size-6" />
        </button>
        <span className="lg:hidden" />

        <div className="flex items-center gap-1 sm:gap-4">
          <label className="sr-only" htmlFor="fiscal-year">
            Fiscal year
          </label>
          <Select
            id="fiscal-year"
            value={String(fiscalYear)}
            onChange={(e) => dispatch(fiscalYearChanged(Number(e.target.value) as FiscalYear))}
            options={FISCAL_YEARS.map((fy) => ({ value: String(fy), label: `FY ${fy}` }))}
            className="w-24 sm:w-28"
          />
          <div className="hidden items-center gap-2 xl:flex">
            <Building2 className="size-5 text-gray-700" aria-hidden />
            <label className="sr-only" htmlFor="agency">
              Agency
            </label>
            <Select
              id="agency"
              value={agencyId}
              onChange={(e) => dispatch(agencyChanged(e.target.value as AgencyId))}
              options={AGENCIES.map((a) => ({ value: a.id, label: a.name }))}
              className="w-64 border-transparent font-medium shadow-none hover:bg-gray-50"
            />
          </div>
          <NotificationsMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
