import type { Metadata } from "next";
import { PrexcItemsView } from "@/features/master-data/components/MasterDataViews";

export const metadata: Metadata = { title: "PREXC Items" };

export default function Page() {
  return <PrexcItemsView />;
}
