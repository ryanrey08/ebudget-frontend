import type { Metadata } from "next";
import { getAllotmentClassBySlug } from "@/lib/constants/allotment-classes";
import { RegistryView } from "@/features/allotment-classes/components/registry/RegistryView";

export const metadata: Metadata = { title: "RAOMO Allotments" };

export default function Page() {
  return <RegistryView meta={getAllotmentClassBySlug("raomo")!} />;
}
