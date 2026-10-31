import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { AppropriationStatus } from "../../types";

const tones: Record<AppropriationStatus, BadgeTone> = {
  Released: "blue",
  Active: "green",
  Unreleased: "gray",
  Draft: "amber",
};

export function AppropriationStatusBadge({ status }: { status: AppropriationStatus }) {
  return <Badge tone={tones[status]}>{status}</Badge>;
}
