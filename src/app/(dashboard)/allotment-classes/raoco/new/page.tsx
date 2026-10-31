import type { Metadata } from "next";
import { getAllotmentClassBySlug } from "@/lib/constants/allotment-classes";
import { RegistryAllotmentWizard } from "@/features/allotment-classes/components/registry/RegistryAllotmentWizard";

export const metadata: Metadata = { title: "New RAOCO Allotment" };

export default function Page() {
  return <RegistryAllotmentWizard meta={getAllotmentClassBySlug("raoco")!} />;
}
