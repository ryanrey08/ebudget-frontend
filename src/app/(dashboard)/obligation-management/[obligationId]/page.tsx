import type { Metadata } from "next";
import { ObligationDetailView } from "@/features/obligation-management/components/detail/ObligationDetailView";

export const metadata: Metadata = { title: "Obligation" };

export default async function Page({ params }: { params: Promise<{ obligationId: string }> }) {
  return <ObligationDetailView id={(await params).obligationId} />;
}
