import type { Metadata } from "next";
import { FiscalYearsView } from "@/features/master-data/components/MasterDataViews";

export const metadata: Metadata = { title: "Fiscal Years" };

export default function Page() {
  return <FiscalYearsView />;
}
