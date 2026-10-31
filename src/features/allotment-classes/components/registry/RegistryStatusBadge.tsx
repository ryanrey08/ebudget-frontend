import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { Allotment } from "@/features/allotments/types";

/** Status shown on allotment-class pages: approved allotments are labelled by utilization. */
export function registryStatus(a: Allotment): string {
  if (a.status === "Released" || a.status === "Partial") return a.obligated >= a.amount ? "Fully Utilized" : "Active";
  return a.status;
}

const tones: Record<string, BadgeTone> = {
  Active: "green",
  "Fully Utilized": "blue",
  Unreleased: "amber",
  "For Approval": "purple",
  Draft: "gray",
  Returned: "amber",
  Rejected: "red",
};

export function RegistryStatusBadge({ allotment }: { allotment: Allotment }) {
  const label = registryStatus(allotment);
  return <Badge tone={tones[label] ?? "gray"}>{label}</Badge>;
}
