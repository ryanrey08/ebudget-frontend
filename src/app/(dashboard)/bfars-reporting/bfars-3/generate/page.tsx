import type { Metadata } from "next";
import { SaaodboeGenerator } from "@/features/bfars-reporting/saaodboe/SaaodboeGenerator";

export const metadata: Metadata = { title: "Generate BFARS 3 – SAAODBOE" };

export default function Page() {
  return <SaaodboeGenerator />;
}
