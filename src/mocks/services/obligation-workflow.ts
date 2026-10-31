import { OBLIGATION_STEPS, type ObligationStatus, type ObligationStep, type ObligationStepKey } from "@/features/obligation-management/types";

/** Sample approvers used for seeded history (match the demo users). */
export const OBLIGATION_ACTORS: Record<ObligationStepKey, { name: string; position: string }> = {
  encode: { name: "Juan Dela Cruz", position: "Budget Officer" },
  submit: { name: "Juan Dela Cruz", position: "Budget Officer" },
  review: { name: "Ana Villanueva", position: "Budget Head" },
  accountant: { name: "Maria Santos", position: "Accountant" },
  certification: { name: "Antonio Reyes", position: "Head of Agency" },
  release: { name: "Antonio Reyes", position: "Head of Agency" },
};

const HOUR = 3_600_000;

/** Builds the workflow trail for a seeded obligation at the given status. */
export function seedObligationWorkflow(status: ObligationStatus, encodedAt: string): ObligationStep[] {
  const reached: Record<ObligationStatus, number> = {
    Draft: 1,
    Returned: 1,
    "For Approval": 2,
    Approved: 4,
    Released: 6,
    Cancelled: 2,
  };
  const current = reached[status];
  const start = new Date(encodedAt).getTime();
  return OBLIGATION_STEPS.map<ObligationStep>((key, i) => {
    if (i < current) {
      return {
        key,
        status: "completed",
        actorName: OBLIGATION_ACTORS[key].name,
        actorPosition: OBLIGATION_ACTORS[key].position,
        actedAt: new Date(start + i * 5 * HOUR).toISOString(),
        remarks: i >= 2 ? "Approved." : undefined,
        signature: key === "certification" ? OBLIGATION_ACTORS[key].name : undefined,
      };
    }
    if (status === "Cancelled" && i === current) {
      return { key, status: "rejected", actorName: OBLIGATION_ACTORS[key].name, actorPosition: OBLIGATION_ACTORS[key].position, actedAt: new Date(start + i * 5 * HOUR).toISOString(), remarks: "Duplicate request." };
    }
    return { key, status: i === current && status !== "Released" ? "current" : "pending" };
  });
}

export const obligationCurrentIndex = (steps: ObligationStep[]) => steps.findIndex((s) => s.status === "current");
