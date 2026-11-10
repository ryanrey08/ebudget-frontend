import type { Metadata } from "next";
import { AuoGenerator } from "@/features/bfars-reporting/auo/AuoGenerator";

export const metadata: Metadata = { title: "Generate BFARS 8 – Aging of Unpaid Obligations" };

export default function Page() {
  return <AuoGenerator />;
}
