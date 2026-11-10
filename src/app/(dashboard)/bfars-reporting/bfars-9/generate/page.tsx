import type { Metadata } from "next";
import { MrdGenerator } from "@/features/bfars-reporting/mrd/MrdGenerator";

export const metadata: Metadata = { title: "Generate BFARS 9 – Monthly Report of Disbursement" };

export default function Page() {
  return <MrdGenerator />;
}
