import type { Metadata } from "next";
import { Suspense } from "react";
import { GaaUploadWorkflow } from "@/features/appropriations/components/gaa-upload/GaaUploadWorkflow";

export const metadata: Metadata = { title: "GAA Upload" };

export default function Page() {
  return (
    <Suspense>
      <GaaUploadWorkflow />
    </Suspense>
  );
}
