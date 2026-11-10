import type { Metadata } from "next";
import { SaaodboeView } from "@/features/bfars-reporting/saaodboe/SaaodboeView";

export const metadata: Metadata = { title: "BFARS 3 – SAAODBOE" };

export default function Page() {
  return <SaaodboeView />;
}
