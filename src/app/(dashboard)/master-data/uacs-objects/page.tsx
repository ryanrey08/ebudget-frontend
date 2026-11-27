import type { Metadata } from "next";
import { UacsObjectsView } from "@/features/master-data/components/MasterDataViews";

export const metadata: Metadata = { title: "UACS Objects" };

export default function Page() {
  return <UacsObjectsView />;
}
