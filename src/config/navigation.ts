import {
  ChartColumnBig,
  ClipboardList,
  Database,
  ShieldCheck,
  FilePlus2,
  FileText,
  House,
  Layers,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/constants/routes";
import { ALLOTMENT_CLASSES } from "@/lib/constants/allotment-classes";
import { BFARS_REPORTS } from "@/lib/constants/bfars";
import type { Permission } from "@/features/auth/types";

export type NavLeaf =
  | { label: string; href: string; icon?: LucideIcon; permission?: Permission }
  | { label: string; action: "logout"; icon?: LucideIcon; permission?: Permission };

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Direct link (items without children). */
  href?: string;
  children?: NavLeaf[];
  /** Path prefix that marks the parent as active. */
  matchPrefix?: string;
  /**
   * Backend permission needed to see the item (GET /auth/me `permissions`).
   * UI only: the backend authorises every request itself. Children can carry
   * their own permission; a group whose children are all hidden is hidden.
   */
  permission?: Permission;
}

export const NAVIGATION: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: House, href: ROUTES.dashboard },
  {
    id: "appropriations",
    label: "Appropriations",
    icon: FilePlus2,
    matchPrefix: "/appropriations",
    children: [
      { label: "GAA Upload", href: ROUTES.gaaUpload, permission: "appropriations.manage" },
      { label: "Appropriations", href: ROUTES.appropriations, permission: "appropriations.view" },
      { label: "Allotments", href: ROUTES.allotments, permission: "allotments.view" },
    ],
  },
  {
    id: "obligation-management",
    label: "Obligation Management",
    icon: ClipboardList,
    href: ROUTES.obligationManagement,
  },
  {
    id: "allotment-classes",
    label: "Allotment Classes",
    icon: Layers,
    matchPrefix: "/allotment-classes",
    children: ALLOTMENT_CLASSES.map((c) => ({ label: c.code, href: ROUTES.allotmentClass(c.slug) })),
  },
  {
    id: "bfars-reporting",
    label: "BFARS Reporting",
    icon: ChartColumnBig,
    matchPrefix: "/bfars-reporting",
    children: BFARS_REPORTS.map((r) => ({ label: `BFARS ${r.number}`, href: ROUTES.bfars(r.id) })),
  },
  { id: "reports", label: "Reports", icon: FileText, href: ROUTES.reports },
  {
    id: "master-data",
    label: "Master Data",
    icon: Database,
    matchPrefix: "/master-data",
    children: [
      { label: "Fiscal Years", href: ROUTES.fiscalYears, permission: "fiscal_years.view" },
      { label: "Organizations", href: ROUTES.organizations, permission: "organizations.view" },
      { label: "PREXC Items", href: ROUTES.prexcItems, permission: "prexc_items.view" },
      { label: "UACS Objects", href: ROUTES.uacsObjects, permission: "uacs_objects.view" },
      { label: "Fund Sources", href: ROUTES.fundSources, permission: "fund_sources.view" },
      { label: "Allotment Classes", href: ROUTES.backendAllotmentClasses, permission: "allotment_classes.view" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: ShieldCheck,
    matchPrefix: "/administration",
    children: [
      { label: "Users", href: ROUTES.users, permission: "users.view" },
      { label: "Roles & Permissions", href: ROUTES.roles, permission: "roles.view" },
      { label: "Signatories", href: ROUTES.signatories, permission: "signatories.view" },
      { label: "Approval Workflows", href: ROUTES.approvalWorkflows, permission: "approval_workflows.view" },
      { label: "Agency Profile", href: ROUTES.agencyProfile, permission: "agency_profile.view" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    matchPrefix: "/settings",
    children: [
      { label: "Profile", href: ROUTES.profile },
      { label: "Logout", action: "logout", icon: LogOut },
    ],
  },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Breadcrumb trail for the current path, derived from the navigation tree. */
export function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  for (const item of NAVIGATION) {
    if (item.href && isActivePath(pathname, item.href)) return [{ label: item.label }];
    for (const child of item.children ?? []) {
      if ("href" in child && isActivePath(pathname, child.href)) {
        return item.label === child.label ? [{ label: child.label }] : [{ label: item.label }, { label: child.label }];
      }
    }
  }
  return [];
}
