import type { Metadata } from "next";
import { Suspense } from "react";
import { NewAllotmentView } from "@/features/allotments/components/NewAllotmentView";

export const metadata: Metadata = { title: "New Allotment" };

export default function Page() {
  return (
    <Suspense>
      <NewAllotmentView />
    </Suspense>
  );
}
