import { Badge, type BadgeTone } from "@/components/ui/Badge";

const STATUS_TONES: Record<string, BadgeTone> = {
  Posted: "green",
  Released: "green",
  Imported: "green",
  Ready: "green",
  Validated: "blue",
  Uploaded: "gray",
  Updated: "blue",
  "With Warning": "amber",
  Failed: "red",
  Skipped: "gray",
  Approved: "green",
  Certified: "blue",
  Partial: "amber",
  Pending: "amber",
  "For Review": "amber",
  "For Approval": "blue",
  Returned: "amber",
  Processing: "amber",
  "On Track": "green",
  "Needs Attention": "amber",
  "On Hold": "gray",
  Draft: "gray",
  Cancelled: "red",
  "With Errors": "red",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "gray"}>{status}</Badge>;
}
