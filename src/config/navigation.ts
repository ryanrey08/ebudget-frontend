import {
  ChartColumnBig,
  ClipboardList,
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

export type NavLeaf =
  | { label: string; href: string; icon?: LucideIcon }
  | { label: string; action: "logout"; icon?: LucideIcon };

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Direct link (items without children). */
  href?: string;
  children?: NavLeaf[];
  /** Path prefix that marks the parent as active. */
  matchPrefix?: string;
}

export const NAVIGATION: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: House, href: ROUTES.dashboard },
  {
    id: "appropriations",
    label: "Appropriations",
    icon: FilePlus2,
    matchPrefix: "/appropriations",
    children: [
      { label: "GAA Upload", href: ROUTES.gaaUpload },
      { label: "Appropriations", href: ROUTES.appropriations },
      { label: "Allotments", href: ROUTES.allotments },
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
