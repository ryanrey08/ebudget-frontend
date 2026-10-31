import type { Metadata } from "next";
import { Suspense } from "react";
import { EditObligationView } from "@/features/obligation-management/components/EditObligationView";

export const metadata: Metadata = { title: "Edit Obligation" };

export default async function Page({ params }: { params: Promise<{ obligationId: string }> }) {
  const { obligationId } = await params;
  return (
    <Suspense>
      <EditObligationView id={obligationId} />
    </Suspense>
  );
}
