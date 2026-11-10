import type { Metadata } from "next";
import { LasaGenerator } from "@/features/bfars-reporting/lasa/LasaGenerator";

export const metadata: Metadata = { title: "Generate BFARS 4 – LASA" };

export default function Page() {
  return <LasaGenerator />;
}
