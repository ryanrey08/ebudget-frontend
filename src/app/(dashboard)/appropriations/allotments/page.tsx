import type { Metadata } from "next";
import { AllotmentsView } from "@/features/allotments/components/AllotmentsView";

export const metadata: Metadata = { title: "Allotments" };

export default function Page() {
  return <AllotmentsView />;
}
