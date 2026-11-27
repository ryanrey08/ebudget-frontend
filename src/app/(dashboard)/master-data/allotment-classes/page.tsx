import type { Metadata } from "next";
import { AllotmentClassRecordsView } from "@/features/master-data/components/MasterDataViews";

export const metadata: Metadata = { title: "Allotment Classes" };

export default function Page() {
  return <AllotmentClassRecordsView />;
}
