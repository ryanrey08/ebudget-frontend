import type { Metadata } from "next";
import { MrdView } from "@/features/bfars-reporting/mrd/MrdView";

export const metadata: Metadata = { title: "BFARS 9 – Monthly Report of Disbursement" };

export default function Page() {
  return <MrdView />;
}
