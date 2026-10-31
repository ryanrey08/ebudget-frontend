import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { AllotmentStatus } from "../types";

const tones: Record<AllotmentStatus, BadgeTone> = {
  Released: "green",
  Partial: "blue",
  Unreleased: "amber",
  "For Approval": "purple",
  Draft: "gray",
  Returned: "amber",
  Rejected: "red",
};

export function AllotmentStatusBadge({ status }: { status: AllotmentStatus }) {
  return <Badge tone={tones[status]}>{status}</Badge>;
}
