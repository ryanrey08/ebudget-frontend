import type { Metadata } from "next";
import { Suspense } from "react";
import { NewAllotmentRecordView } from "@/features/allotments/components/records/NewAllotmentRecordView";

export const metadata: Metadata = { title: "New Allotment" };

export default function Page() {
  return (
    <Suspense>
      <NewAllotmentRecordView />
    </Suspense>
  );
}
