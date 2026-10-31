import type { QproRow, QproStatus } from "@/features/bfars-reporting/qpro/types";
import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";

const M = 1_000_000;

/**
 * Per-PAP totals from MPC_BFARS1_QPRO_Sample_Q1_2026.xlsx (sample data only). The
 * activity rows below are split from these so the totals match the workbook.
 */
const PAPS: {
  pap: string;
  title: string;
  cls: AllotmentClassCode;
  uacsMajor: string;
  actual: number;
  allotment: number;
  obligations: number;
  disbursements: number;
  activities: [name: string, department: string, programType?: string, startYear?: number][];
}[] = [
  {
    pap: "PAP-001", title: "General Administration and Support Services", cls: "RAOPS", uacsMajor: "502", actual: 95,
    allotment: 150 * M, obligations: 120 * M, disbursements: 112.5 * M,
    activities: [
      ["Executive management and governance", "General Administration"],
      ["Budget and financial management", "Finance Office"],
      ["Accounting services", "Finance Office"],
      ["Cash management and disbursement", "Finance Office"],
      ["Procurement services", "Procurement Unit"],
      ["Human resource management", "Human Resource Office"],
      ["Records management", "Administrative Services"],
      ["Supply and property management", "Administrative Services"],
      ["General services and utilities", "General Services"],
      ["ICT infrastructure and services", "ICT Services", undefined, 2026],
      ["Legal services", "General Administration"],
      ["Planning and quality assurance", "General Administration"],
      ["Internal audit", "General Administration"],
      ["Security services", "General Services"],
      ["Facilities maintenance", "General Services", undefined, 2025],
    ],
  },
  {
    pap: "PAP-002", title: "Instructional Services", cls: "RAOMO", uacsMajor: "501", actual: 90,
    allotment: 80 * M, obligations: 60 * M, disbursements: 48 * M,
    activities: [
      ["Undergraduate degree programs", "Academic Affairs"],
      ["Graduate programs", "Academic Affairs"],
      ["Technical-vocational programs", "Academic Affairs"],
      ["Curriculum development", "Academic Affairs"],
      ["Faculty development", "Academic Affairs"],
      ["Library services", "Academic Affairs"],
      ["Laboratory operations", "Academic Affairs"],
      ["Student assessment and admission", "Student Affairs"],
      ["Program accreditation", "Academic Affairs"],
      ["Learning resources development", "Academic Affairs", undefined, 2026],
      ["Online learning support", "ICT Services", undefined, 2026],
      ["Student guidance and counseling", "Student Affairs"],
    ],
  },
  {
    pap: "PAP-003", title: "Research and Development", cls: "RAOCO", uacsMajor: "504", actual: 88,
    allotment: 70 * M, obligations: 50 * M, disbursements: 39.2 * M,
    activities: [
      ["Institutional research", "Research Office"],
      ["Applied research projects", "Research Office", "Locally-Funded Projects"],
      ["Research publications", "Research Office"],
      ["Research conferences", "Research Office"],
      ["Intellectual property management", "Research Office"],
      ["Research capability building", "Research Office"],
      ["Innovation center operations", "Research Office", "Foreign-Assisted Projects", 2026],
      ["Research ethics review", "Research Office"],
      ["Technology transfer", "Research Office", "Foreign-Assisted Projects"],
      ["Research grants administration", "Research Office", "Locally-Funded Projects"],
      ["Research laboratory upgrading", "Research Office", "Locally-Funded Projects"],
    ],
  },
  {
    pap: "PAP-004", title: "Extension Services", cls: "RAOFE", uacsMajor: "506", actual: 97,
    allotment: 120 * M, obligations: 80 * M, disbursements: 71 * M,
    activities: [
      ["Community extension programs", "Extension Office"],
      ["Technical skills training", "Extension Office", "Locally-Funded Projects"],
      ["Livelihood programs", "Extension Office", "Locally-Funded Projects"],
      ["Teacher training outreach", "Extension Office"],
      ["Industry partnerships", "Extension Office", "Foreign-Assisted Projects"],
      ["Alumni engagement", "Student Affairs", undefined, 2026],
      ["Community health and safety", "Extension Office"],
      ["Environmental programs", "Extension Office", "Foreign-Assisted Projects"],
      ["Disaster preparedness training", "Extension Office", "Locally-Funded Projects", 2025],
      ["Extension monitoring and evaluation", "Extension Office"],
    ],
  },
];

const FUND_BY_TYPE: Record<string, string> = {
  "Regular Programs": "101",
  "Support to Operations": "101",
  "Locally-Funded Projects": "164",
  "Foreign-Assisted Projects": "151",
};

// Offsets around each PAP's actual %, summing to zero so the PAP average matches the workbook.
const ACTUAL_OFFSETS = [5, -3, 2, -6, 4, -2, 3, -5, 1, -1, 4, -2, 0, -3, 3];
const WEIGHTS = [1.3, 0.8, 1.1, 0.7, 1.0, 1.2, 0.9, 0.6, 1.4, 0.75, 1.05, 0.85, 0.95, 1.15, 0.65];
const SPEND_JITTER = [0.06, -0.04, 0.03, -0.07, 0.02, -0.03, 0.05, -0.02, 0.04, -0.06, 0.01, -0.01, 0.03, -0.05, 0.02];

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/** Spreads `total` over `weights`, rounding to the nearest thousand; the last share takes the remainder. */
function spread(total: number, weights: number[]) {
  const sum = weights.reduce((s, w) => s + w, 0);
  let used = 0;
  return weights.map((w, i) => {
    const v = i === weights.length - 1 ? total - used : roundTo((total * w) / sum, 1000);
    used += v;
    return v;
  });
}

function sampleStatus(actual: number): QproStatus {
  if (actual >= 90) return "On Track";
  if (actual >= 85) return "Needs Attention";
  return "At Risk";
}

export interface QproSeedRow extends QproRow {
  /** First fiscal year the activity is reported (for year-on-year counts). */
  startYear: number;
}

/** BFARS 1 activity rows for Q1 FY 2026 (sample data). */
export function buildQproRows(): QproSeedRow[] {
  return PAPS.flatMap((p) => {
    const n = p.activities.length;
    // Keep every row at or below the 100% target.
    const scale = Math.min(1, (100 - p.actual) / Math.max(...ACTUAL_OFFSETS.slice(0, n)));
    const offsets = ACTUAL_OFFSETS.slice(0, n).map((o) => Math.round(o * scale * 10) / 10);
    offsets[n - 1] = Math.round((offsets[n - 1] - offsets.reduce((s, o) => s + o, 0)) * 10) / 10;
    const weights = WEIGHTS.slice(0, n);
    const allotments = spread(p.allotment, weights);
    const obligations = spread(p.obligations, allotments.map((a, i) => a * (1 + SPEND_JITTER[i])));
    const disbursements = spread(p.disbursements, obligations.map((o, i) => o * (1 - SPEND_JITTER[(i + 3) % SPEND_JITTER.length])));
    return p.activities.map(([name, department, programType, startYear], i) => {
      const type = programType ?? (p.pap === "PAP-001" ? "Support to Operations" : "Regular Programs");
      const actual = Math.round((p.actual + offsets[i]) * 10) / 10;
      return {
        code: `${p.pap}-${String(i + 1).padStart(2, "0")}`,
        pap: p.pap,
        papTitle: p.title,
        program: name,
        allotmentClass: p.cls,
        uacsMajor: p.uacsMajor,
        department,
        fundSource: FUND_BY_TYPE[type],
        programType: type,
        physicalTarget: 100,
        physicalActual: actual,
        allotment: allotments[i],
        obligations: obligations[i],
        disbursements: disbursements[i],
        status: sampleStatus(actual),
        startYear: startYear ?? 2024,
      };
    });
  });
}
