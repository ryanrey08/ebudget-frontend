import type { Metadata } from "next";
import { AgencyProfileView } from "@/features/administration/components/AgencyProfileView";

export const metadata: Metadata = { title: "Agency Profile" };

export default function Page() {
  return <AgencyProfileView />;
}
