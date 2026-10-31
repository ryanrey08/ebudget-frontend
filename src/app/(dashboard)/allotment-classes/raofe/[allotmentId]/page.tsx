import type { Metadata } from "next";
import { getAllotmentClassBySlug } from "@/lib/constants/allotment-classes";
import { RaofeAllotmentView } from "@/features/allotment-classes/components/registry/RaofeAllotmentView";

export const metadata: Metadata = { title: "RAOFE Allotment" };

export default async function Page({ params }: { params: Promise<{ allotmentId: string }> }) {
  return <RaofeAllotmentView meta={getAllotmentClassBySlug("raofe")!} id={(await params).allotmentId} />;
}
