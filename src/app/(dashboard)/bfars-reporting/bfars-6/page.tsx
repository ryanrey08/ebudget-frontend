import type { Metadata } from "next";
import { SabudbView } from "@/features/bfars-reporting/sabudb/SabudbView";

export const metadata: Metadata = { title: "BFARS 6 – SABUDB" };

export default function Page() {
  return <SabudbView />;
}
