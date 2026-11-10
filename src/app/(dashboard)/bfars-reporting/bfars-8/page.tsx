import type { Metadata } from "next";
import { AuoView } from "@/features/bfars-reporting/auo/AuoView";

export const metadata: Metadata = { title: "BFARS 8 – Aging of Unpaid Obligations" };

export default function Page() {
  return <AuoView />;
}
