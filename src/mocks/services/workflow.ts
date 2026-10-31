import type {
  AllotmentRelease,
  AllotmentStatus,
  WorkflowStep,
  WorkflowStepKey,
} from "@/features/allotments/types";
import { WORKFLOW_STEPS } from "@/features/allotments/types";

/** Sample approvers used for seeded history (match the demo users). */
export const SAMPLE_ACTORS: Record<WorkflowStepKey, { name: string; position: string }> = {
  prepared: { name: "Juan Dela Cruz", position: "Budget Officer" },
  submit: { name: "Juan Dela Cruz", position: "Budget Officer" },
  review: { name: "Ana Villanueva", position: "Budget Head" },
  accountant: { name: "Maria Santos", position: "Accountant" },
  certification: { name: "Antonio Reyes", position: "Head of Agency" },
  release: { name: "Antonio Reyes", position: "Head of Agency" },
};

/** Where a seeded allotment sits in the approval flow. */
export type SeedStage = "review" | "accountant" | "certification" | "Unreleased" | "Partial" | "Released";

const HOUR = 3_600_000;

export function seedWorkflow(
  stage: SeedStage,
  preparedAt: string,
  releaseNo: string,
): { workflow: WorkflowStep[]; status: AllotmentStatus; release?: AllotmentRelease } {
  const order: Record<SeedStage, number> = { review: 1, accountant: 2, certification: 3, Unreleased: 4, Partial: 5, Released: 5 };
  const currentIndex = order[stage];
  const start = new Date(preparedAt).getTime();
  const workflow = WORKFLOW_STEPS.map<WorkflowStep>((key, i) => {
    if (i < currentIndex) {
      return {
        key,
        status: "completed",
        actorName: SAMPLE_ACTORS[key].name,
        actorPosition: SAMPLE_ACTORS[key].position,
        actedAt: new Date(start + i * 26 * HOUR).toISOString(),
        remarks: i === 0 ? undefined : "Approved.",
      };
    }
    return { key, status: i === currentIndex ? "current" : "pending" };
  });
  if (stage === "Partial" || stage === "Released") {
    return {
      workflow,
      status: stage,
      release: {
        releaseNo,
        releaseDate: preparedAt.slice(0, 10),
        mdsReferenceNo: releaseNo.replace("REL", "MDS"),
        releasedAt: workflow[4].actedAt,
      },
    };
  }
  if (stage === "Unreleased") {
    return { workflow, status: "Unreleased", release: { releaseNo, releaseDate: preparedAt.slice(0, 10) } };
  }
  return { workflow, status: "For Approval" };
}

export function currentStepIndex(workflow: WorkflowStep[]) {
  return workflow.findIndex((s) => s.status === "current");
}
