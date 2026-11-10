import type { Metadata } from "next";
import { SodlbiaftView } from "@/features/bfars-reporting/sodlbiaft/SodlbiaftView";

export const metadata: Metadata = { title: "BFARS 5 – SODLBIAFT" };

export default function Page() {
  return <SodlbiaftView />;
}
