"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { NAVIGATION, isActivePath, type NavItem } from "@/config/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeMobileSidebar,
  expandSidebar,
  selectMobileSidebarOpen,
  selectSidebarCollapsed,
} from "@/store/slices/uiSlice";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { LogoLockup } from "@/components/shared/Logo";
import { cn } from "@/lib/utils/cn";

function isItemActive(item: NavItem, pathname: string) {
  if (item.href) return isActivePath(pathname, item.href);
  return item.matchPrefix ? isActivePath(pathname, item.matchPrefix) : false;
}

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileOpen = useAppSelector(selectMobileSidebarOpen);
  const { logout, isLoggingOut } = useLogout();

  // Groups open by default when they contain the active route.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAVIGATION.filter((i) => i.children).map((i) => [i.id, isItemActive(i, pathname)])),
  );

  useEffect(() => {
    const active = NAVIGATION.find((i) => i.children && isItemActive(i, pathname));
    if (active) setOpenGroups((prev) => (prev[active.id] ? prev : { ...prev, [active.id]: true }));
    dispatch(closeMobileSidebar());
  }, [pathname, dispatch]);

  const toggleGroup = (id: string) => {
    if (collapsed) {
      dispatch(expandSidebar());
      setOpenGroups((prev) => ({ ...prev, [id]: true }));
      return;
    }
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const iconOnly = collapsed && !mobileOpen;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden
        onClick={() => dispatch(closeMobileSidebar())}
        className={cn(
          "fixed inset-0 z-40 bg-gray-900/50 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          "fixed bottom-0 left-0 z-50 flex flex-col bg-sidebar text-white transition-[width,transform] duration-200",
          "top-0 w-72 lg:top-[72px] lg:z-30",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-20" : "lg:w-[276px]",
        )}
      >
        {/* Drawer header (mobile only) */}
        <div className="flex h-[72px] items-center justify-between bg-white px-4 lg:hidden">
          <LogoLockup />
          <button
            type="button"
            onClick={() => dispatch(closeMobileSidebar())}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2.5 py-3">
          <ul className="space-y-1">
            {NAVIGATION.map((item) => {
              const active = isItemActive(item, pathname);
              const Icon = item.icon;
              const baseRow = cn(
                "group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-[15px] font-medium transition-colors",
                iconOnly && "justify-center px-0",
              );

              if (item.href) {
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      title={iconOnly ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        baseRow,
                        active
                          ? "bg-brand-600 text-white shadow-[0_4px_14px_rgba(215,31,38,0.35)]"
                          : "text-gray-100 hover:bg-sidebar-hover",
                      )}
                    >
                      <Icon className="size-[22px] shrink-0" aria-hidden />
                      {!iconOnly && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              }

              const open = !iconOnly && openGroups[item.id];
              const groupId = `nav-group-${item.id}`;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.id)}
                    aria-expanded={open}
                    aria-controls={groupId}
                    title={iconOnly ? item.label : undefined}
                    className={cn(
                      baseRow,
                      active ? "bg-sidebar-hover text-white" : "text-gray-100 hover:bg-sidebar-hover",
                      active && "relative before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r before:bg-brand-600",
                    )}
                  >
                    <Icon className={cn("size-[22px] shrink-0", active && "text-brand-400")} aria-hidden />
                    {!iconOnly && (
                      <>
                        <span className="flex-1 truncate text-left">{item.label}</span>
                        <ChevronDown
                          className={cn("size-4 shrink-0 text-gray-300 transition-transform", open && "rotate-180")}
                          aria-hidden
                        />
                      </>
                    )}
                  </button>
                  {open && (
                    <ul id={groupId} className="mt-0.5 mb-2 space-y-0.5 pl-[3.25rem]">
                      {item.children?.map((child) => {
                        const childClass =
                          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-[15px] transition-colors";
                        if ("action" in child) {
                          const ChildIcon = child.icon;
                          return (
                            <li key={child.label}>
                              <button
                                type="button"
                                onClick={logout}
                                disabled={isLoggingOut}
                                className={cn(childClass, "text-sidebar-muted hover:bg-sidebar-hover hover:text-white disabled:opacity-60")}
                              >
                                {ChildIcon && <ChildIcon className="size-4" aria-hidden />}
                                {isLoggingOut ? "Signing out…" : child.label}
                              </button>
                            </li>
                          );
                        }
                        const childActive = isActivePath(pathname, child.href);
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                childClass,
                                childActive
                                  ? "bg-brand-600/15 font-semibold text-white before:mr-1 before:size-1.5 before:rounded-full before:bg-brand-500"
                                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white",
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        {!iconOnly && (
          <p className="border-t border-white/10 px-6 py-3 text-xs text-gray-400">eBudget v1.0 · FY 2026</p>
        )}
      </aside>
    </>
  );
}
