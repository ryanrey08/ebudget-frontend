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
  // eBudget backend status labels
  "Pending Approval": "amber",
  "Fully Released": "green",
  Active: "blue",
  Inactive: "gray",
  Rejected: "red",
  Open: "green",
  Closed: "amber",
  Locked: "gray",
  Queued: "gray",
  Completed: "green",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "gray"}>{status}</Badge>;
}
