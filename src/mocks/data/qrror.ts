import type { QrrorRow } from "@/features/bfars-reporting/qrror/types";

const M = 1_000_000;

type Line = [date: string, classification: QrrorRow["classification"], uacsCode: string, description: string, office: string, amount: number];

/** UACS accounts of the sample workbook (placeholders, not validated codes). */
export const QRROR_ACCOUNTS: { code: string; label: string; classification: QrrorRow["classification"] }[] = [
  { code: "4-01-01", label: "Tuition Fees", classification: "4-01" },
  { code: "4-01-02", label: "Miscellaneous School Fees", classification: "4-01" },
  { code: "4-01-03", label: "Service Fees", classification: "4-01" },
  { code: "4-02-01", label: "Interest Income", classification: "4-02" },
  { code: "4-02-02", label: "Rental Income", classification: "4-02" },
  { code: "4-02-03", label: "Other Non-Operating Income", classification: "4-02" },
  { code: "4-03-01", label: "Donations", classification: "4-03" },
  { code: "4-03-02", label: "Fines and Penalties", classification: "4-03" },
  { code: "4-03-03", label: "Refunds and Reimbursements", classification: "4-03" },
];

/**
 * FY 2026 Q1 receipts (illustrative sample, not actual MPC records), the 12 transactions of
 * MPC_BFARS10_QRROR_Sample_Q1_2026: ₱85M (Operations 60M, Non-Operations 20M, Other Receipts 5M; January 27M,
 * February 29M, March 29M). Offices are illustrative (the references have no office column).
 */
const LINES: Line[] = [
  ["2026-01-05", "4-01", "4-01-01", "Tuition Fees", "Academic Affairs", 12 * M],
  ["2026-01-15", "4-01", "4-01-02", "Miscellaneous School Fees", "Academic Affairs", 8 * M],
  ["2026-01-20", "4-02", "4-02-01", "Interest Income", "Finance Office", 6 * M],
  ["2026-01-25", "4-03", "4-03-01", "Donations", "Administrative Services", 1 * M],
  ["2026-02-10", "4-01", "4-01-01", "Tuition Fees", "Academic Affairs", 14 * M],
  ["2026-02-15", "4-01", "4-01-03", "Service Fees", "Research Office", 6 * M],
  ["2026-02-18", "4-02", "4-02-02", "Rental Income", "Administrative Services", 7 * M],
  ["2026-02-25", "4-03", "4-03-02", "Fines and Penalties", "Finance Office", 2 * M],
  ["2026-03-05", "4-01", "4-01-01", "Tuition Fees", "Academic Affairs", 15 * M],
  ["2026-03-12", "4-01", "4-01-03", "Service Fees", "Research Office", 5 * M],
  ["2026-03-15", "4-02", "4-02-03", "Other Non-Operating Income", "Finance Office", 7 * M],
  ["2026-03-28", "4-03", "4-03-03", "Refunds and Reimbursements", "Finance Office", 2 * M],
];

export const QRROR_Q1_ROWS: QrrorRow[] = LINES.map(([date, classification, uacsCode, description, office, amount], i) => ({
  referenceNo: `RV-2026-${String(i + 1).padStart(3, "0")}`,
  date,
  classification,
  uacsCode,
  description,
  office,
  amount,
}));
