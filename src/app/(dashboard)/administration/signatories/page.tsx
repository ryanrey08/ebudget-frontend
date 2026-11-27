import type { Metadata } from "next";
import { SignatoriesView } from "@/features/administration/components/SignatoriesView";

export const metadata: Metadata = { title: "Signatories" };

export default function Page() {
  return <SignatoriesView />;
}
