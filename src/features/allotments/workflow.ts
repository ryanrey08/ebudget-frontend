import type { Allotment, AllotmentDetail, WorkflowStepKey } from "./types";
import { ALLOTMENT_CLASSES, ALLOTMENT_CLASS_CODES } from "@/lib/constants/allotment-classes";

export const STEP_LABELS: Record<WorkflowStepKey, { done: string; todo: string }> = {
  prepared: { done: "Prepared by Budget Officer", todo: "Prepared by Budget Officer" },
  submit: { done: "Submitted for Approval", todo: "Submit for Approval" },
  review: { done: "Reviewed by Budget Head", todo: "Review by Budget Head" },
  accountant: { done: "Approved by Accountant", todo: "Approved by Accountant" },
  certification: { done: "Certified by Head of Agency", todo: "Certify by Head of Agency" },
  release: { done: "Released", todo: "Released" },
};

export interface CheckItem {
  label: string;
  /** Auto checks are computed from the record; manual ones are confirmed by the approver. */
  kind: "auto" | "manual";
  ok?: boolean;
}

export interface StepPage {
  title: string;
  description: string;
  checklistTitle: string;
  remarksTitle: string;
  remarksLabel: string;
  remarksPlaceholder: string;
  approveLabel: string;
  certification?: string;
}

/** Page copy for each approval step (from the eBudget workflow screens). */
export const STEP_PAGES: Record<Exclude<WorkflowStepKey, "prepared" | "submit">, StepPage> = {
  review: {
    title: "Review by Budget Head",
    description: "Review the allotment details, verify compliance and approve, return for revision, or reject.",
    checklistTitle: "Validation Checklist",
    remarksTitle: "Budget Head Remarks",
    remarksLabel: "Remarks",
    remarksPlaceholder: "e.g. All details are correct and in compliance with the approved appropriation.",
    approveLabel: "Approve",
  },
  accountant: {
    title: "Approved by Accountant",
    description: "Review the allotment for accounting requirements, verify fund availability, and approve.",
    checklistTitle: "Accounting Validation",
    remarksTitle: "Accountant Remarks",
    remarksLabel: "Remarks (optional)",
    remarksPlaceholder: "e.g. Accounting requirements are complete and in order. Fund is available.",
    approveLabel: "Approve",
  },
  certification: {
    title: "Certify by Head of Agency",
    description: "Review the allotment details, certify the accuracy and compliance, and approve for release.",
    checklistTitle: "Certification Checklist",
    remarksTitle: "Head of Agency Certification",
    remarksLabel: "Certification Remarks (optional)",
    remarksPlaceholder: "e.g. Certified and approved for release.",
    approveLabel: "Certify and Approve for Release",
    certification:
      "I hereby certify that the allotment is in accordance with the approved appropriation, program and applicable laws, rules and regulations, and hereby approve for release.",
  },
  release: {
    title: "Certified and Approved for Release",
    description: "Confirm the release details and approve the allotment for release.",
    checklistTitle: "Final Validation Checklist",
    remarksTitle: "Release Remarks",
    remarksLabel: "Remarks (optional)",
    remarksPlaceholder: "Optional notes for this release.",
    approveLabel: "Approve for Release",
    certification:
      "By certifying and approving, I confirm that the allotment is accurate, complete, and in compliance with applicable laws, rules and regulations, and is hereby approved for release.",
  },
};

/** Facts about the record that the checklists are built from. */
export function recordChecks({ allotment: a, appropriation: app }: AllotmentDetail) {
  const priorDone = (key: WorkflowStepKey) => {
    const index = a.workflow.findIndex((s) => s.key === key);
    return a.workflow.slice(0, index).every((s) => s.status === "completed");
  };
  const available = app ? app.remaining + (a.status === "Draft" || a.status === "Rejected" ? 0 : a.amount) : 0;
  return {
    appropriationActive: !!app && app.status !== "Draft",
    uacsValid: /^\d{8}$/.test(a.uacsCode),
    classValid: (ALLOTMENT_CLASS_CODES as readonly string[]).includes(a.allotmentClass),
    withinBalance: !!app && a.amount <= available,
    releaseValid: a.releaseAmount > 0 && a.releaseAmount <= a.amount,
    documents: a.documents.length > 0,
    detailsComplete: !!(a.purpose.trim() && a.fundSource && a.releaseDate && a.amount > 0),
    fundSource: !!a.fundSource,
    priorDone,
  };
}

export function stepChecklist(step: Exclude<WorkflowStepKey, "prepared" | "submit">, detail: AllotmentDetail): CheckItem[] {
  const c = recordChecks(detail);
  const auto = (label: string, ok: boolean): CheckItem => ({ label, kind: "auto", ok });
  const manual = (label: string): CheckItem => ({ label, kind: "manual" });
  switch (step) {
    case "review":
      return [
        auto("Appropriation exists and is active", c.appropriationActive),
        auto("UACS Code is valid", c.uacsValid),
        auto("Allotment class is valid", c.classValid),
        auto("Amount does not exceed balance", c.withinBalance),
        auto("Required documents are attached", c.documents),
        auto("Details are complete", c.detailsComplete),
      ];
    case "accountant":
      return [
        auto("Fund source is valid", c.fundSource),
        auto("UACS code is correct", c.uacsValid),
        auto("Allotment amount is within available balance", c.withinBalance),
        auto("Tranche and release amount are correct", c.releaseValid),
        manual("Accounting rules and COA guidelines complied"),
        auto("Supporting documents are complete", c.documents),
      ];
    case "certification":
      return [
        auto("All previous approvals are completed", c.priorDone("certification")),
        auto("Allotment is within the approved appropriation", c.withinBalance),
        auto("Fund source and UACS code are correct", c.fundSource && c.uacsValid),
        auto("Purpose and particulars are valid", c.detailsComplete),
        auto("Supporting documents are complete", c.documents),
        manual("Ready for certification and release"),
      ];
    case "release":
      return [
        auto("All previous approvals are completed", c.priorDone("release")),
        auto("All supporting documents are complete", c.documents),
        auto("Allotment is within the approved appropriation", c.withinBalance),
        auto("Fund source, tranche and amount are correct", c.fundSource && c.releaseValid),
        manual("Complies with COA, DBM and agency guidelines"),
        manual("Ready for release"),
      ];
  }
}

export function currentStep(a: Allotment) {
  return a.workflow.find((s) => s.status === "current")?.key;
}

/** Detail page for an allotment: registry records open under their allotment-class page. */
export function allotmentHref(a: Pick<Allotment, "id" | "allotmentClass" | "workflowType">) {
  if (a.workflowType === "registry") {
    const slug = ALLOTMENT_CLASSES.find((c) => c.code === a.allotmentClass)?.slug ?? "raop";
    return `/allotment-classes/${slug}/${a.id}`;
  }
  return `/appropriations/allotments/${a.id}`;
}
