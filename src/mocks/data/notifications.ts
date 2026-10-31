import type { AppNotification } from "@/features/notifications/types";
import { ROUTES } from "@/lib/constants/routes";

export const NOTIFICATIONS_SEED: AppNotification[] = [
  {
    id: "ntf-005",
    title: "Obligation awaiting review",
    message: "OBL-2026-076 (₱4,120,000.00) was submitted for review.",
    createdAt: "2026-10-30T07:45:00.000Z",
    read: false,
    href: ROUTES.obligationManagement,
    kind: "warning",
  },
  {
    id: "ntf-004",
    title: "GAA upload has errors",
    message: "GAA_MPC_FY2026_Supplemental.xlsx has rows that need correction.",
    createdAt: "2026-10-18T14:42:00.000Z",
    read: false,
    href: `${ROUTES.gaaUpload}?batch=gaa-2026-002`,
    kind: "warning",
  },
  {
    id: "ntf-003",
    title: "Allotment released",
    message: "ALT-2026-018 MOOE – 2nd Tranche (₱25,000,000.00) has been released.",
    createdAt: "2026-10-18T09:10:00.000Z",
    read: false,
    href: ROUTES.allotments,
    kind: "success",
  },
  {
    id: "ntf-002",
    title: "BFARS 2 generated",
    message: "SAAODB for FY 2026 Q3 is ready for download.",
    createdAt: "2026-10-15T10:24:00.000Z",
    read: true,
    href: ROUTES.reports,
    kind: "info",
  },
  {
    id: "ntf-001",
    title: "Quarterly reporting reminder",
    message: "BFARS Q3 submissions are due on October 30, 2026.",
    createdAt: "2026-10-01T08:00:00.000Z",
    read: true,
    href: ROUTES.bfars("bfars-1"),
    kind: "info",
  },
];
