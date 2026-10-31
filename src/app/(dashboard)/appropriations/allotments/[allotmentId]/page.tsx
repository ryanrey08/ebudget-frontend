import type { Metadata } from "next";
import { AllotmentDetailView } from "@/features/allotments/components/detail/AllotmentDetailView";

export const metadata: Metadata = { title: "Allotment" };

export default async function Page({ params }: { params: Promise<{ allotmentId: string }> }) {
  return <AllotmentDetailView id={(await params).allotmentId} />;
}
