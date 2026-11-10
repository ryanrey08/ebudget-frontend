import type { Metadata } from "next";
import { QrrorGenerator } from "@/features/bfars-reporting/qrror/QrrorGenerator";

export const metadata: Metadata = { title: "Generate BFARS 10 – Quarterly Report of Revenue and Other Receipts" };

export default function Page() {
  return <QrrorGenerator />;
}
