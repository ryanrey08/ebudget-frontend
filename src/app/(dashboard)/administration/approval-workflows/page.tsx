import type { Metadata } from "next";
import { ApprovalWorkflowsView } from "@/features/approvals/components/ApprovalWorkflowsView";

export const metadata: Metadata = { title: "Approval Workflows" };

export default function Page() {
  return <ApprovalWorkflowsView />;
}
