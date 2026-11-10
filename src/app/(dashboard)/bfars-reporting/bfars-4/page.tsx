import type { Metadata } from "next";
import { LasaView } from "@/features/bfars-reporting/lasa/LasaView";

export const metadata: Metadata = { title: "BFARS 4 – LASA" };

export default function Page() {
  return <LasaView />;
}
