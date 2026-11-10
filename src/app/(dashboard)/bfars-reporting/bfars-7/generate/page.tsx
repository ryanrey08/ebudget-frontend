import type { Metadata } from "next";
import { SabudboeGenerator } from "@/features/bfars-reporting/sabudboe/SabudboeGenerator";

export const metadata: Metadata = { title: "Generate BFARS 7 – SABUDBOE" };

export default function Page() {
  return <SabudboeGenerator />;
}
