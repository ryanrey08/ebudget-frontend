import type { Metadata } from "next";
import { QrrorView } from "@/features/bfars-reporting/qrror/QrrorView";

export const metadata: Metadata = { title: "BFARS 10 – Quarterly Report of Revenue and Other Receipts" };

export default function Page() {
  return <QrrorView />;
}
