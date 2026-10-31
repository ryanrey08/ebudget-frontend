import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALLOTMENT_CLASSES, getAllotmentClassBySlug } from "@/lib/constants/allotment-classes";
import { AllotmentClassView } from "@/features/allotment-classes/components/AllotmentClassView";

type Props = { params: Promise<{ classSlug: string }> };

// One static route per allotment class: /allotment-classes/raop, /raomo, /raoco, /raofe
export const dynamicParams = false;

export function generateStaticParams() {
  // Classes with their own route folder (registry design and workflow) are excluded.
  return ALLOTMENT_CLASSES.filter((c) => !["raop", "raomo", "raoco", "raofe"].includes(c.slug)).map((c) => ({ classSlug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meta = getAllotmentClassBySlug((await params).classSlug);
  return { title: meta ? meta.code : "Allotment Class" };
}

export default async function Page({ params }: Props) {
  const meta = getAllotmentClassBySlug((await params).classSlug);
  if (!meta) notFound();
  return <AllotmentClassView meta={meta} />;
}
