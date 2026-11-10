import type { MrdRow } from "@/features/bfars-reporting/mrd/types";

const M = 1_000_000;

type Line = [date: string, payee: string, uacsCode: string, objectOfExpenditure: string, objectClass: MrdRow["objectClass"], cls: MrdRow["allotmentClass"], description: string, office: string, amount: number];

/**
 * FY 2026 disbursements (illustrative sample, not actual MPC records), following MPC_BFARS9_MRD_Sample_March_2026:
 * January–February are PS only (₱90M), and March has the workbook's 11 vouchers (₱150M: PS 50M, MOOE 60M, CO 30M,
 * FE 5M, Others 5M), for ₱240M year to date. UACS codes and objects of expenditure follow the dashboard mockup;
 * offices are illustrative (the mockups have no office column).
 */
const LINES: Line[] = [
  ["2026-01-15", "Landbank of the Philippines", "5-01-0101", "Salaries and Wages", "PS", "RAOPS", "Salaries – Regular", "Academic Affairs", 27 * M],
  ["2026-01-20", "GSIS", "5-01-0201", "Personnel Benefits", "PS", "RAOPS", "GSIS – Employer Share", "Administrative Services", 12 * M],
  ["2026-01-22", "PhilHealth", "5-01-0203", "Personnel Benefits", "PS", "RAOPS", "PhilHealth – Employer Share", "Administrative Services", 6 * M],
  ["2026-02-13", "Landbank of the Philippines", "5-01-0101", "Salaries and Wages", "PS", "RAOPS", "Salaries – Regular", "Academic Affairs", 27 * M],
  ["2026-02-18", "GSIS", "5-01-0201", "Personnel Benefits", "PS", "RAOPS", "GSIS – Employer Share", "Administrative Services", 12 * M],
  ["2026-02-20", "PhilHealth", "5-01-0203", "Personnel Benefits", "PS", "RAOPS", "PhilHealth – Employer Share", "Administrative Services", 6 * M],
  ["2026-03-02", "Landbank of the Philippines", "5-01-0101", "Salaries and Wages", "PS", "RAOPS", "Salaries and Wages", "Academic Affairs", 30 * M],
  ["2026-03-03", "GSIS", "5-01-0201", "Personnel Benefits", "PS", "RAOPS", "Employer Contributions", "Administrative Services", 20 * M],
  ["2026-03-05", "ABC Construction Corp.", "5-03-0101", "Machinery and Equipment", "CO", "RAOCO", "Laboratory Equipment", "Research Office", 20 * M],
  ["2026-03-07", "XYZ Trading", "5-02-0201", "Office Supplies", "MOOE", "RAOMO", "Office Supplies", "Administrative Services", 20 * M],
  ["2026-03-09", "Manila Electric Company", "5-02-0403", "Electricity", "MOOE", "RAOMO", "Electricity", "Administrative Services", 15 * M],
  ["2026-03-11", "PLDT", "5-02-0406", "Communication", "MOOE", "RAOMO", "Communication", "Administrative Services", 12 * M],
  ["2026-03-15", "Tech Solutions Inc.", "5-02-0305", "ICT Services", "MOOE", "RAOMO", "IT Services", "Academic Affairs", 8 * M],
  ["2026-03-18", "ICT Supplier Inc.", "5-03-0101", "Machinery and Equipment", "CO", "RAOCO", "ICT Equipment", "Administrative Services", 10 * M],
  ["2026-03-22", "Facility Maintenance Inc.", "5-02-0501", "Repairs and Maintenance", "MOOE", "RAOMO", "Repairs and Maintenance", "Administrative Services", 5 * M],
  ["2026-03-25", "Government Servicing Bank", "5-04-0101", "Bank Charges", "FE", "RAOFE", "Bank Charges and Fees", "Finance Office", 5 * M],
  ["2026-03-28", "Miscellaneous Payees", "5-05-0101", "Other Expenses", "Others", "RAOFE", "Other Approved Expenditures", "Finance Office", 5 * M],
];

const seq: Record<string, number> = {};
export const MRD_FY2026_ROWS: MrdRow[] = LINES.map(([date, payee, uacsCode, objectOfExpenditure, objectClass, allotmentClass, description, office, amount]) => {
  const ym = date.slice(0, 7);
  seq[ym] = (seq[ym] ?? 0) + 1;
  return {
    referenceNo: `DV-${ym}-${String(seq[ym]).padStart(3, "0")}`,
    date,
    payee,
    uacsCode,
    objectOfExpenditure,
    objectClass,
    allotmentClass,
    description,
    office,
    fundSource: "GAA",
    amount,
  };
});
