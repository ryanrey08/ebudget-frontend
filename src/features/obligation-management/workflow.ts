import type { Obligation, ObligationStepKey } from "./types";

export const OBLIGATION_STEP_LABELS: Record<ObligationStepKey, string> = {
  encode: "Encode Details",
  submit: "Submit for Approval",
  review: "Review and Approve by Budget Head",
  accountant: "Approved by Accountant",
  certification: "Certified by Head of Agency",
  release: "Released",
};

/** Page copy per step, from the eBudget obligation workflow screens. */
export const OBLIGATION_STEP_PAGES: Partial<
  Record<ObligationStepKey, { title: string; description: string; remarksTitle: string; remarksRequired: boolean; approveLabel: string }>
> = {
  submit: {
    title: "Submit for Approval",
    description: "Review the obligation details and submit for approval.",
    remarksTitle: "Approval Remarks",
    remarksRequired: false,
    approveLabel: "Submit for Approval",
  },
  review: {
    title: "Review and Approve",
    description: "Review the obligation details, supporting documents and approve or return for revision.",
    remarksTitle: "Review Remarks",
    remarksRequired: false,
    approveLabel: "Approve",
  },
  accountant: {
    title: "Approved by Accountant",
    description: "Review the obligation details, verify the supporting documents and approve or return for revision.",
    remarksTitle: "Accountant Remarks",
    remarksRequired: true,
    approveLabel: "Approve",
  },
  certification: {
    title: "Certify and Approve for Release",
    description: "Review the obligation details, certify its correctness and approve for release of funds.",
    remarksTitle: "Remarks",
    remarksRequired: false,
    approveLabel: "Certify and Approve for Release",
  },
};

export const CERTIFICATION_TEXT =
  "I hereby certify that the foregoing obligation is legal, proper and in accordance with existing laws, rules and regulations, and approve the same for release of funds.";

export function obligationCurrentStep(o: Obligation) {
  return o.workflow.find((s) => s.status === "current")?.key;
}

export function canEditObligation(o: Obligation) {
  return o.status === "Draft" || o.status === "Returned";
}
