import type { Metadata } from "next";
import { AllotmentRecordsView } from "@/features/allotments/components/records/AllotmentRecordsView";

export const metadata: Metadata = { title: "Allotments" };

export default function Page() {
  return <AllotmentRecordsView />;
}
