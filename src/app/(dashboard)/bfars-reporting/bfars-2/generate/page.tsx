import type { Metadata } from "next";
import { SaaodbGenerator } from "@/features/bfars-reporting/saaodb/SaaodbGenerator";

export const metadata: Metadata = { title: "Generate BFARS 2 – SAAODB" };

export default function Page() {
  return <SaaodbGenerator />;
}
