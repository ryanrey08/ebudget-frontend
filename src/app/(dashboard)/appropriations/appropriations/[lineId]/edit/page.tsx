import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppropriationLineFormView } from "@/features/appropriations/components/lines/AppropriationLineForm";

export const metadata: Metadata = { title: "Edit Appropriation" };

export default async function Page({ params }: { params: Promise<{ lineId: string }> }) {
  const id = Number((await params).lineId);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <AppropriationLineFormView lineId={id} />;
}
