import type { Metadata } from "next";
import { AppropriationLinesView } from "@/features/appropriations/components/lines/AppropriationLinesView";

export const metadata: Metadata = { title: "Appropriations" };

export default function Page() {
  return <AppropriationLinesView />;
}
