import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { ObligationStatus } from "../types";

const tones: Record<ObligationStatus, BadgeTone> = {
  Draft: "amber",
  "For Approval": "blue",
  Approved: "green",
  Released: "green",
  Returned: "amber",
  Cancelled: "red",
};

export function ObligationStatusBadge({ status }: { status: ObligationStatus }) {
  return <Badge tone={tones[status]}>{status}</Badge>;
}
