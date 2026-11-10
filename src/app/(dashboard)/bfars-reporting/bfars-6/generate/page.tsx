import type { Metadata } from "next";
import { SabudbGenerator } from "@/features/bfars-reporting/sabudb/SabudbGenerator";

export const metadata: Metadata = { title: "Generate BFARS 6 – SABUDB" };

export default function Page() {
  return <SabudbGenerator />;
}
