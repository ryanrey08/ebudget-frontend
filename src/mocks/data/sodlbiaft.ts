import type { SodlbiaftRow } from "@/features/bfars-reporting/sodlbiaft/types";

const M = 1_000_000;

/** Source agencies in the order of the BFARS 5 report. */
export const SODLBIAFT_AGENCIES = [
  { code: "DOST", name: "Department of Science and Technology" },
  { code: "CHED", name: "Commission on Higher Education" },
  { code: "DOH", name: "Department of Health" },
  { code: "DA", name: "Department of Agriculture" },
  { code: "DICT", name: "Department of Information and Communications Technology" },
  { code: "Others", name: "Various Agencies" },
];

/** Program/Project categories of the "Distribution by Program/Project" chart. */
export const SODLBIAFT_PROGRAMS = ["Research and Development", "Infrastructure Development", "Health Programs", "Training and Capacity Building", "Others"];

type Line = [agency: string, project: string, program: string, office: string, ref: string, date: string, received: number, obligations: number, disbursements: number, liquidations: number, status: SodlbiaftRow["status"]];

/**
 * FY 2026 Q1 inter-agency fund transfers (illustrative sample, not actual MPC records).
 * Projects, offices, references and dates are those of the BFARS 5 report mockup. Its amounts don't add up to its
 * own totals, so these are set to match the dashboard's totals (₱120M received, ₱90M obligated, ₱70M disbursed,
 * ₱50M liquidated), per-agency bars and program split (40/30/20/15/15M).
 */
const LINES: Line[] = [
  ["DOST", "Research Equipment Upgrade", "Research and Development", "Academic Affairs", "DOST-2026-001", "2026-01-10", 20 * M, 15 * M, 12 * M, 8 * M, "On Track"],
  ["DOST", "Innovation and R&D Program", "Research and Development", "Research Unit", "DOST-2026-002", "2026-02-15", 15 * M, 12 * M, 10 * M, 7 * M, "On Track"],
  ["CHED", "HEI Development Program", "Infrastructure Development", "Planning Office", "CHED-2026-001", "2026-01-15", 20 * M, 16 * M, 12 * M, 9 * M, "On Track"],
  ["CHED", "Faculty Development", "Research and Development", "Human Resource Office", "CHED-2026-002", "2026-02-20", 5 * M, 4 * M, 3 * M, 2 * M, "On Track"],
  ["DOH", "Health Services Program", "Health Programs", "Health Center", "DOH-2026-001", "2026-01-20", 20 * M, 15 * M, 12 * M, 9 * M, "Monitor"],
  ["DA", "Agricultural Program", "Others", "Research Unit", "DA-2026-001", "2026-02-05", 15 * M, 11 * M, 8 * M, 6 * M, "On Track"],
  ["DICT", "ICT Infrastructure", "Infrastructure Development", "ICT Office", "DICT-2026-001", "2026-02-18", 10 * M, 7 * M, 5 * M, 3 * M, "Monitor"],
  ["Others", "Training and Capacity Building", "Training and Capacity Building", "Admin Services", "OTH-2026-001", "2026-03-01", 15 * M, 10 * M, 8 * M, 6 * M, "For Liquidation"],
];

export const SODLBIAFT_Q1_ROWS: SodlbiaftRow[] = LINES.map(([sourceAgency, project, program, office, referenceNo, dateReceived, fundsReceived, obligations, disbursements, liquidations, status]) => ({
  sourceAgency,
  project,
  program,
  office,
  referenceNo,
  dateReceived,
  fundsReceived,
  obligations,
  disbursements,
  liquidations,
  status,
}));
