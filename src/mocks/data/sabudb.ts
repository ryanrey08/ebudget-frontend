import type { SabudbRow } from "@/features/bfars-reporting/sabudb/types";

const M = 1_000_000;

/**
 * BFARS 6 (SABUDB) lines from the BFARS 6 report mockup (illustrative, FY 2026 Q1).
 * Per-class totals follow MPC_BFARS6_SABUDB_Sample_Q1_2026.xlsx (PS disbursements ₱129M, so the
 * grand total is ₱240M); where the mockup's line amounts don't add up to those totals, lines were
 * adjusted to the totals. No supplemental budget in the sample.
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

export const SABUDB_LINES: SabudbRow[] = [
  line("5010101", "PS", "Salaries and Wages", 160, 144, 130, 109),
  line("5010201", "PS", "Personnel Benefits", 30, 27, 25, 18),
  line("5010301", "PS", "Other Personnel Expenses", 10, 9, 5, 2),
  line("5020101", "MOOE", "Travel Expenses", 20, 18, 12, 10),
  line("5020201", "MOOE", "Supplies and Materials", 40, 32, 30, 22),
  line("5020301", "MOOE", "Professional Services", 50, 40, 35, 28),
  line("5020401", "MOOE", "Repairs and Maintenance", 20, 20, 10, 8),
  line("5029901", "MOOE", "Other MOOE", 10, 10, 3, 2),
  line("5030101", "CO", "Machinery and Equipment", 60, 55, 35, 25),
  line("5030201", "CO", "Infrastructure Outlay", 40, 35, 15, 10),
  line("5040101", "FE", "Bank Charges and Interest", 40, 30, 8, 5),
  line("5050101", "Others", "Contingent Fund", 20, 15, 2, 1),
];
