import type { Metadata } from "next";
import { getAllotmentClassBySlug } from "@/lib/constants/allotment-classes";
import { RegistryAllotmentForm } from "@/features/allotment-classes/components/registry/RegistryAllotmentForm";

export const metadata: Metadata = { title: "New RAOMO Allotment" };

export default function Page() {
  return <RegistryAllotmentForm meta={getAllotmentClassBySlug("raomo")!} />;
}
