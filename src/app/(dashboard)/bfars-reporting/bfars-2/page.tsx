import type { Metadata } from "next";
import { SaaodbView } from "@/features/bfars-reporting/saaodb/SaaodbView";

export const metadata: Metadata = { title: "BFARS 2 – SAAODB" };

export default function Page() {
  return <SaaodbView />;
}
