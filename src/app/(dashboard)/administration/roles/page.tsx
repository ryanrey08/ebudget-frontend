import type { Metadata } from "next";
import { RolesView } from "@/features/access/components/RolesView";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default function Page() {
  return <RolesView />;
}
