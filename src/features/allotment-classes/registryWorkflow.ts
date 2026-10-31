import type { AllotmentDetail, WorkflowStepKey } from "@/features/allotments/types";

/** Step names used on allotment-class (RAOPS) screens. */
export const REGISTRY_STEP_LABELS: Partial<Record<WorkflowStepKey, string>> = {
  prepared: "Encode Details",
  submit: "Submit for Approval",
  review: "Review and Approve",
  accountant: "Approved by Accountant",
  certification: "Certified by Head of Agency",
};

export const REGISTRY_STEP_PAGES: Partial<Record<WorkflowStepKey, { title: string; description: string; panelTitle: string; approveLabel: string; signature: boolean }>> = {
  submit: {
    title: "Submit for Approval",
    description: "Review the allotment details and submit for approval.",
    panelTitle: "Submission Details",
    approveLabel: "Submit for Approval",
    signature: false,
  },
  review: {
    title: "Review and Approve",
    description: "Review the allotment details, verify completeness and approve.",
    panelTitle: "Approval Details",
    approveLabel: "Approve",
    signature: false,
  },
  accountant: {
    title: "Approved by Accountant",
    description: "Verify the allotment for accounting requirements and approve.",
    panelTitle: "Accountant Approval",
    approveLabel: "Approve",
    signature: true,
  },
  certification: {
    title: "Certified by Head of Agency",
    description: "Review the allotment and certify it.",
    panelTitle: "Certification by Head of Agency",
    approveLabel: "Certify",
    signature: true,
  },
};

/** Checks computed from the record (no approval rules are assumed beyond these). */
export function registryChecklist({ allotment: a, appropriation }: AllotmentDetail) {
  const available = appropriation ? appropriation.remaining + (a.status === "Draft" || a.status === "Rejected" ? 0 : a.amount) : 0;
  const lines = a.lineItems ?? [];
  return [
    { label: "All allotment information is complete", ok: !!(a.appropriationRef && a.department && a.fundSource && a.purpose && a.gaaReferenceNo) },
    { label: "Line items and amounts are encoded", ok: lines.length > 0 && lines.every((l) => l.amount > 0) },
    { label: "Supporting documents are attached", ok: a.documents.length > 0 },
    { label: "UACS codes are valid", ok: [a.uacsCode, ...lines.map((l) => l.uacsCode)].every((c) => /^\d+$/.test(c)) },
    { label: "Amount is within the approved appropriation", ok: !!appropriation && a.amount <= available },
  ];
}
