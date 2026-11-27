import type { Metadata } from "next";
import { FundSourcesView } from "@/features/master-data/components/MasterDataViews";

export const metadata: Metadata = { title: "Fund Sources" };

export default function Page() {
  return <FundSourcesView />;
}
