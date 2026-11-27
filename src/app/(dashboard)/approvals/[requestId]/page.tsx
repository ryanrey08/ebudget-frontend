import type { Metadata } from "next";
import { ApprovalRequestView } from "@/features/approvals/components/ApprovalRequestView";

export const metadata: Metadata = { title: "Approval Request" };

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  return <ApprovalRequestView requestId={(await params).requestId} />;
}
