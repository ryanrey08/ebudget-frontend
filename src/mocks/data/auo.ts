import type { AuoRow } from "@/features/bfars-reporting/auo/types";

const M = 1_000_000;

type Line = [dateObligated: string, dueDate: string, payee: string, object: AuoRow["objectOfExpenditure"], cls: AuoRow["allotmentClass"], uacsCode: string, description: string, office: string, amount: number];

/**
 * FY 2026 unpaid obligations (illustrative sample, not actual MPC records).
 * The 15 lines are those of the BFARS 8 report mockup (references, payees, classes, UACS codes, descriptions)
 * and each lands in the mockup's aging bracket as of March 31, 2026. The mockup's line amounts add up to
 * ₱80.5M against its own ₱70M total, so amounts are sized to the bracket totals that the mockup, the dashboard
 * and the sample workbook all show: Current ₱15M, 1–30 ₱20M, 31–60 ₱18M, 61–90 ₱10M, Over 90 ₱7M.
 * Due dates are illustrative (the workbook notes aging must be validated against actual due dates).
 */
const LINES: Line[] = [
  ["2026-01-05", "2026-01-05", "ABC Construction Corp.", "CO", "RAOCO", "5-03-0101", "Building Renovation", "Administrative Services", 6 * M],
  ["2026-01-20", "2026-01-20", "XYZ Trading", "MOOE", "RAOPS", "5-02-0201", "Office Supplies", "Administrative Services", 4 * M],
  ["2026-02-15", "2026-02-14", "ACME Technologies", "MOOE", "RAOPS", "5-02-0301", "IT Equipment", "Administrative Services", 8 * M],
  ["2026-02-25", "2026-03-11", "PhilPower Corp.", "PS", "RAOPS", "5-01-0101", "Salaries and Wages", "Academic Affairs", 12 * M],
  ["2026-03-01", "2026-04-15", "Metro Supplies Inc.", "MOOE", "RAOMO", "5-02-0101", "Fuel and Lubricants", "Administrative Services", 2.5 * M],
  ["2026-03-10", "2026-04-09", "Tech Solutions Inc.", "CO", "RAOCO", "5-03-0201", "Laboratory Equipment", "Research Office", 5 * M],
  ["2026-03-15", "2026-04-14", "CleanPlus Services", "MOOE", "RAOFE", "5-02-0401", "Janitorial Services", "Administrative Services", 3 * M],
  ["2026-03-20", "2026-03-20", "Global Medical Supply", "MOOE", "RAOFE", "5-02-0501", "Medical Supplies", "Administrative Services", 4 * M],
  ["2026-02-18", "2026-02-18", "JKL Engineering", "CO", "RAOCO", "5-03-0301", "Infrastructure - Phase II", "Administrative Services", 4 * M],
  ["2026-01-28", "2026-02-27", "Prima Marketing", "MOOE", "RAOPS", "5-02-0105", "Training and Seminars", "Academic Affairs", 3.5 * M],
  ["2026-02-05", "2026-02-05", "Greenfield Contractors", "CO", "RAOCO", "5-03-0401", "ICT Infrastructure", "Research Office", 2.5 * M],
  ["2026-02-12", "2026-03-14", "Marikina IT Solutions", "MOOE", "RAOMO", "5-02-0305", "Software Licenses", "Research Office", 2 * M],
  ["2026-03-05", "2026-04-04", "SafeSecure Corp.", "MOOE", "RAOFE", "5-02-0203", "Security Services", "Administrative Services", 4.5 * M],
  // Obligated in December of the previous year: the mockup's Jan 18 date cannot be over 90 days old by March 31.
  ["2025-12-18", "2025-12-18", "BuildRight Corp.", "CO", "RAOCO", "5-03-0102", "Land Improvement", "Administrative Services", 7 * M],
  ["2026-02-28", "2026-03-15", "EduTech Solutions", "MOOE", "RAOPS", "5-02-0303", "Learning Materials", "Academic Affairs", 2 * M],
];

export const AUO_FY2026_ROWS: AuoRow[] = LINES.map(([dateObligated, dueDate, payee, objectOfExpenditure, allotmentClass, uacsCode, description, office, amount], i) => ({
  referenceNo: `OBL-2026-${String(i + 1).padStart(4, "0")}`,
  dateObligated,
  dueDate,
  payee,
  objectOfExpenditure,
  allotmentClass,
  uacsCode,
  description,
  office,
  amount,
}));
