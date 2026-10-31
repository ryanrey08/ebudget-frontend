import type { Metadata } from "next";
import { getAllotmentClassBySlug } from "@/lib/constants/allotment-classes";
import { RaofeAllotmentWizard } from "@/features/allotment-classes/components/registry/RaofeAllotmentWizard";

export const metadata: Metadata = { title: "New RAOFE Allotment" };

export default function Page() {
  return <RaofeAllotmentWizard meta={getAllotmentClassBySlug("raofe")!} />;
}
