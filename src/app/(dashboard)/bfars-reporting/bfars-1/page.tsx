import type { Metadata } from "next";
import { QproView } from "@/features/bfars-reporting/qpro/QproView";

export const metadata: Metadata = { title: "BFARS 1 – QPRO" };

export default function Page() {
  return <QproView />;
}
