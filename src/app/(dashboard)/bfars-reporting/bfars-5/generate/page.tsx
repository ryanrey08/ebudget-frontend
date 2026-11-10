import type { Metadata } from "next";
import { SodlbiaftGenerator } from "@/features/bfars-reporting/sodlbiaft/SodlbiaftGenerator";

export const metadata: Metadata = { title: "Generate BFARS 5 – SODLBIAFT" };

export default function Page() {
  return <SodlbiaftGenerator />;
}
