import type { Metadata } from "next";
import { SabudbtrView } from "@/features/bfars-reporting/sabudbtr/SabudbtrView";

export const metadata: Metadata = { title: "BFARS 11 – Statement of Approved Budget, Utilizations, Disbursements and Balances for Trust Receipts" };

export default function Page() {
  return <SabudbtrView />;
}
