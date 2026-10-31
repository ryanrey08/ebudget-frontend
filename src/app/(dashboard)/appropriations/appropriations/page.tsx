import type { Metadata } from "next";
import { AppropriationsView } from "@/features/appropriations/components/appropriations/AppropriationsView";

export const metadata: Metadata = { title: "Appropriations" };

export default function Page() {
  return <AppropriationsView />;
}
