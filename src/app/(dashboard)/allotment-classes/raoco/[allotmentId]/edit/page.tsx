import type { Metadata } from "next";
import { getAllotmentClassBySlug } from "@/lib/constants/allotment-classes";
import { EditRegistryAllotment } from "@/features/allotment-classes/components/registry/EditRegistryAllotment";

export const metadata: Metadata = { title: "Edit RAOCO Allotment" };

export default async function Page({ params }: { params: Promise<{ allotmentId: string }> }) {
  return <EditRegistryAllotment meta={getAllotmentClassBySlug("raoco")!} id={(await params).allotmentId} />;
}
