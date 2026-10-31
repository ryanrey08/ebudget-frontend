import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BFARS_REPORTS, getBfarsReport } from "@/lib/constants/bfars";
import { BfarsReportView } from "@/features/bfars-reporting/components/BfarsReportView";

type Props = { params: Promise<{ reportId: string }> };

// One static route per report: /bfars-reporting/bfars-1 … /bfars-reporting/bfars-11
export const dynamicParams = false;

export function generateStaticParams() {
  // BFARS 1 has its own route folder (bfars-1/).
  return BFARS_REPORTS.filter((r) => r.id !== "bfars-1").map((r) => ({ reportId: r.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meta = getBfarsReport((await params).reportId);
  return { title: meta ? `BFARS ${meta.number} – ${meta.code}` : "BFARS Report" };
}

export default async function Page({ params }: Props) {
  const meta = getBfarsReport((await params).reportId);
  if (!meta) notFound();
  return <BfarsReportView meta={meta} />;
}
