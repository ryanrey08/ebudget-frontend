import type { Metadata } from "next";
import { SabudbtrGenerator } from "@/features/bfars-reporting/sabudbtr/SabudbtrGenerator";

export const metadata: Metadata = { title: "Generate BFARS 11 – Statement of Approved Budget, Utilizations, Disbursements and Balances for Trust Receipts" };

export default function Page() {
  return <SabudbtrGenerator />;
}
