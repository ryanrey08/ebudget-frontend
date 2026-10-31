import type { Metadata } from "next";
import { QproGenerator } from "@/features/bfars-reporting/qpro/QproGenerator";

export const metadata: Metadata = { title: "Generate BFARS 1 – QPRO" };

export default function Page() {
  return <QproGenerator />;
}
