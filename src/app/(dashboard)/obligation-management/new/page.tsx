import type { Metadata } from "next";
import { Suspense } from "react";
import { ObligationForm } from "@/features/obligation-management/components/ObligationForm";

export const metadata: Metadata = { title: "New Obligation" };

export default function Page() {
  return (
    <Suspense>
      <ObligationForm />
    </Suspense>
  );
}
