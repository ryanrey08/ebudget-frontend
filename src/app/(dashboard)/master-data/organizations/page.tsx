import type { Metadata } from "next";
import { OrganizationsView } from "@/features/master-data/components/MasterDataViews";

export const metadata: Metadata = { title: "Organizations" };

export default function Page() {
  return <OrganizationsView />;
}
