import type { Metadata } from "next";
import { AppropriationLineFormView } from "@/features/appropriations/components/lines/AppropriationLineForm";

export const metadata: Metadata = { title: "New Appropriation" };

export default function Page() {
  return <AppropriationLineFormView />;
}
