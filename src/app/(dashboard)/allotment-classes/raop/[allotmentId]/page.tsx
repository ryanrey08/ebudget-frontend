import type { Metadata } from "next";
import { getAllotmentClassBySlug } from "@/lib/constants/allotment-classes";
import { RegistryAllotmentDetail } from "@/features/allotment-classes/components/registry/RegistryAllotmentDetail";

export const metadata: Metadata = { title: "RAOPS Allotment" };

export default async function Page({ params }: { params: Promise<{ allotmentId: string }> }) {
  return <RegistryAllotmentDetail meta={getAllotmentClassBySlug("raop")!} id={(await params).allotmentId} />;
}
