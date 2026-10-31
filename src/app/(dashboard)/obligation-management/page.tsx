import type { Metadata } from "next";
import { ObligationManagementView } from "@/features/obligation-management/components/ObligationManagementView";

export const metadata: Metadata = { title: "Obligation Management" };

export default function Page() {
  return <ObligationManagementView />;
}
