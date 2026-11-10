import type { SabudbRow } from "@/features/bfars-reporting/sabudb/types";

const M = 1_000_000;

/**
 * BFARS 7 (SABUDBOE) lines from the BFARS 7 report mockup (illustrative, FY 2026 Q1).
 * Per-class totals follow MPC_BFARS7_SABUDBOE_Sample_Q1_2026.xlsx (₱500M / 435M / 310M / 240M);
 * the dashboard mockup's class rows don't add up to its own totals, and where the report mockup's
 * line amounts don't add up to the workbook, lines were adjusted to it. No supplemental budget.
 */
const line = (uacsCode: string, objectClass: SabudbRow["objectClass"], objectOfExpenditure: string, approved: number, allotments: number, obligations: number, disbursements: number): SabudbRow => ({
  uacsCode,
  objectClass,
  objectOfExpenditure,
  gaaOriginal: approved * M,
  supplemental: 0,
  allotments: allotments * M,
  obligations: obligations * M,
  disbursements: disbursements * M,
});

export const SABUDBOE_LINES: SabudbRow[] = [
  line("5010101", "PS", "Salaries and Wages", 120, 110, 100, 80),
  line("5010201", "PS", "Personnel Benefits", 60, 50, 50, 32),
  line("5010301", "PS", "Other Personnel Expenses", 20, 20, 10, 8),
  line("5020101", "MOOE", "Travel Expenses", 30, 25, 20, 16),
  line("5020201", "MOOE", "Supplies and Materials", 50, 45, 30, 22),
  line("5020301", "MOOE", "Professional Services", 40, 40, 22, 18),
  line("5020401", "MOOE", "Repairs and Maintenance", 20, 15, 13, 10),
  line("5029901", "MOOE", "Other MOOE", 10, 5, 5, 4),
  line("5030101", "CO", "Machinery and Equipment", 70, 60, 28, 22),
  line("5030201", "CO", "Infrastructure Outlay", 30, 30, 17, 13),
  line("5040101", "FE", "Bank Charges and Interest", 25, 20, 5, 5),
  line("5050101", "Others", "Contingent Fund", 25, 15, 10, 10),
];

/**
 * MFO/PAP each office's budget is charged to, using the PAPs of the BFARS 1 (QPRO) sample.
 * Used by the report's "Detailed (MFO/PAP and Sub-Object)" view.
 */
export const SABUDBOE_OFFICE_PAP: Record<string, string> = {
  "Administrative Services": "PAP-001 – General Administration and Support Services",
  "Finance Office": "PAP-001 – General Administration and Support Services",
  "Academic Affairs": "PAP-002 – Instructional Services",
  "Research Office": "PAP-003 – Research and Development",
  "Extension Office": "PAP-004 – Extension Services",
};
