import type { Metadata } from "next";
import { AllotmentRecordDetailView } from "@/features/allotments/components/records/AllotmentRecordDetailView";

export const metadata: Metadata = { title: "Allotment" };

export default async function Page({ params }: { params: Promise<{ allotmentId: string }> }) {
  return <AllotmentRecordDetailView id={(await params).allotmentId} />;
}
