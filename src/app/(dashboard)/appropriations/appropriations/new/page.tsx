import type { Metadata } from "next";
import { NewAppropriationView } from "@/features/appropriations/components/new-appropriation/NewAppropriationView";

export const metadata: Metadata = { title: "New Appropriation" };

export default function Page() {
  return <NewAppropriationView />;
}
