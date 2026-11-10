import type { Metadata } from "next";
import { SabudboeView } from "@/features/bfars-reporting/sabudboe/SabudboeView";

export const metadata: Metadata = { title: "BFARS 7 – SABUDBOE" };

export default function Page() {
  return <SabudboeView />;
}
