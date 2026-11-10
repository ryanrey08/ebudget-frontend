import type { LasaRow } from "@/features/bfars-reporting/lasa/types";

const M = 1_000_000;

type Line = [date: string, cls: LasaRow["allotmentClass"], uacsMajor: string, object: string, allottee: string, allotment: number, subAllotment: number, released: number, status: LasaRow["status"], purpose: string];

/**
 * FY 2026 Q1 allotments and sub-allotments (illustrative sample, not actual MPC records).
 * The first ten lines are those of MPC_BFARS4_LASA_Sample_Q1_2026.xlsx and the BFARS 4 mockups;
 * the rest fill the 48 records, class totals and status counts shown in the mockups.
 */
const LINES: Line[] = [
  ["2026-01-05", "RAOPS", "501", "Personnel Services", "Human Resource Office", 50 * M, 48 * M, 45 * M, "Released", "Salaries and wages"],
  ["2026-01-10", "RAOMO", "502", "MOOE", "General Services Office", 30 * M, 28 * M, 25 * M, "Released", "Operating expenses"],
  ["2026-01-12", "RAOCO", "506", "Infrastructure Outlay", "Procurement Office", 20 * M, 18 * M, 12 * M, "Partial", "Equipment"],
  ["2026-01-20", "RAOFE", "504", "Financial Expenses", "Accounting Office", 10 * M, 9 * M, 7.5 * M, "Released", "Bank charges"],
  ["2026-02-02", "RAOPS", "501", "Personnel Services", "CAFA Office", 40 * M, 36 * M, 34 * M, "Released", "Academic staff"],
  ["2026-02-10", "RAOMO", "502", "MOOE", "Supply and Property Office", 25 * M, 22 * M, 15 * M, "Partial", "Supplies"],
  ["2026-02-18", "RAOCO", "506", "Capital Outlay", "ICT Office", 35 * M, 32 * M, 20 * M, "On Hold", "Computers"],
  ["2026-03-01", "RAOFE", "504", "Financial Expenses", "Cashier's Office", 8 * M, 7 * M, 5 * M, "Released", "Bank fees"],
  ["2026-03-10", "RAOPS", "501", "Personnel Services", "Academic Affairs", 60 * M, 55 * M, 50 * M, "Released", "Faculty salaries"],
  ["2026-03-18", "RAOMO", "502", "MOOE", "Research and Extension", 25 * M, 23 * M, 18.5 * M, "Partial", "Research activities"],
  ["2026-01-06", "RAOFE", "504", "Financial Expenses", "Accounting Office", 4 * M, 4 * M, 3.8 * M, "Released", "Bank charges"],
  ["2026-01-08", "RAOPS", "501", "Personnel Services", "Academic Affairs", 4 * M, 3.7 * M, 3.5 * M, "Released", "Honoraria of part-time faculty"],
  ["2026-01-10", "RAOMO", "502", "MOOE", "Library Services", 3 * M, 2.7 * M, 1.6 * M, "Partial", "Library subscriptions"],
  ["2026-01-12", "RAOFE", "504", "Financial Expenses", "Accounting Office", 3.5 * M, 3.2 * M, 3 * M, "Released", "Bank fees"],
  ["2026-03-02", "RAOCO", "506", "Infrastructure Outlay", "Library Services", 6 * M, 5.5 * M, 5.2 * M, "Released", "Library shelving"],
  ["2026-01-14", "RAOFE", "504", "Financial Expenses", "Budget Office", 3 * M, 2.7 * M, 1.6 * M, "Partial", "Other financial charges"],
  ["2026-01-16", "RAOFE", "504", "Financial Expenses", "Accounting Office", 2.5 * M, 2.3 * M, 2.2 * M, "Released", "Bank charges"],
  ["2026-03-04", "RAOPS", "501", "Personnel Services", "Academic Affairs", 3.5 * M, 3.2 * M, 1.3 * M, "On Hold", "Honoraria of part-time faculty"],
  ["2026-01-18", "RAOMO", "502", "MOOE", "General Services Office", 2.5 * M, 2.3 * M, 2.2 * M, "Released", "Utilities"],
  ["2026-02-03", "RAOFE", "504", "Financial Expenses", "Accounting Office", 2 * M, 1.8 * M, 1.1 * M, "Partial", "Bank fees"],
  ["2026-02-05", "RAOCO", "506", "Infrastructure Outlay", "Library Services", 4.5 * M, 4.1 * M, 3.9 * M, "Released", "Library shelving"],
  ["2026-01-20", "RAOFE", "504", "Financial Expenses", "Budget Office", 3 * M, 0 * M, 0 * M, "Cancelled", "Other financial charges"],
  ["2026-03-06", "RAOFE", "504", "Financial Expenses", "Accounting Office", 4.5 * M, 4.1 * M, 3.9 * M, "Released", "Bank charges"],
  ["2026-01-22", "RAOPS", "501", "Personnel Services", "Academic Affairs", 3 * M, 2.7 * M, 2.6 * M, "Released", "Honoraria of part-time faculty"],
  ["2026-02-07", "RAOMO", "502", "MOOE", "Planning Office", 2 * M, 1.8 * M, 1.1 * M, "Partial", "Travel expenses"],
  ["2026-03-08", "RAOFE", "504", "Financial Expenses", "Accounting Office", 2.5 * M, 2.3 * M, 2.2 * M, "Released", "Bank fees"],
  ["2026-01-24", "RAOCO", "506", "Infrastructure Outlay", "Library Services", 3.5 * M, 3.2 * M, 3 * M, "Released", "Library shelving"],
  ["2026-02-09", "RAOFE", "504", "Financial Expenses", "Budget Office", 3 * M, 2.7 * M, 1.6 * M, "Partial", "Other financial charges"],
  ["2026-03-10", "RAOFE", "504", "Financial Expenses", "Accounting Office", 2 * M, 1.8 * M, 1.7 * M, "Released", "Bank charges"],
  ["2026-02-11", "RAOPS", "501", "Personnel Services", "Academic Affairs", 3.5 * M, 3.2 * M, 1.3 * M, "On Hold", "Honoraria of part-time faculty"],
  ["2026-03-12", "RAOMO", "502", "MOOE", "Registrar's Office", 3.5 * M, 3.2 * M, 3 * M, "Released", "Printing of forms"],
  ["2026-01-26", "RAOFE", "504", "Financial Expenses", "Accounting Office", 3.5 * M, 3.2 * M, 1.9 * M, "Partial", "Bank fees"],
  ["2026-02-13", "RAOCO", "506", "Infrastructure Outlay", "Library Services", 5 * M, 4.6 * M, 4.4 * M, "Released", "Library shelving"],
  ["2026-03-14", "RAOFE", "504", "Financial Expenses", "Budget Office", 2.5 * M, 0 * M, 0 * M, "Cancelled", "Other financial charges"],
  ["2026-01-28", "RAOFE", "504", "Financial Expenses", "Accounting Office", 3 * M, 2.7 * M, 2.6 * M, "Released", "Bank charges"],
  ["2026-03-16", "RAOPS", "501", "Personnel Services", "Academic Affairs", 2.5 * M, 2.3 * M, 2.2 * M, "Released", "Honoraria of part-time faculty"],
  ["2026-01-28", "RAOMO", "502", "MOOE", "Library Services", 2 * M, 1.8 * M, 1.1 * M, "Partial", "Library subscriptions"],
  ["2026-02-15", "RAOFE", "504", "Financial Expenses", "Accounting Office", 2 * M, 1.8 * M, 1.7 * M, "Released", "Bank fees"],
  ["2026-03-18", "RAOCO", "506", "Infrastructure Outlay", "Library Services", 3 * M, 2.7 * M, 2.6 * M, "Released", "Library shelving"],
  ["2026-01-28", "RAOFE", "504", "Financial Expenses", "Budget Office", 4 * M, 3.7 * M, 2.2 * M, "Partial", "Other financial charges"],
  ["2026-02-17", "RAOFE", "504", "Financial Expenses", "Accounting Office", 2.5 * M, 2.3 * M, 2.2 * M, "Released", "Bank charges"],
  ["2026-03-20", "RAOPS", "501", "Personnel Services", "Academic Affairs", 3.5 * M, 3.2 * M, 1.3 * M, "On Hold", "Honoraria of part-time faculty"],
  ["2026-01-28", "RAOMO", "502", "MOOE", "General Services Office", 2.5 * M, 2.3 * M, 2.2 * M, "Released", "Utilities"],
  ["2026-02-19", "RAOFE", "504", "Financial Expenses", "Accounting Office", 2.5 * M, 2.3 * M, 1.4 * M, "Partial", "Bank fees"],
  ["2026-03-22", "RAOCO", "506", "Infrastructure Outlay", "Library Services", 3 * M, 2.7 * M, 2.6 * M, "Released", "Library shelving"],
  ["2026-01-28", "RAOFE", "504", "Financial Expenses", "Budget Office", 2 * M, 1.8 * M, 1.7 * M, "Released", "Other financial charges"],
  ["2026-02-21", "RAOMO", "502", "MOOE", "Registrar's Office", 2.5 * M, 2.3 * M, 1.4 * M, "Partial", "Printing of forms"],
  ["2026-01-28", "RAOMO", "502", "MOOE", "Research and Extension", 2 * M, 1.8 * M, 1.1 * M, "Partial", "Extension activities"],
];

export const LASA_Q1_ROWS: LasaRow[] = LINES.map(([date, allotmentClass, uacsMajor, objectOfExpenditure, allottee, allotmentAmount, subAllotmentAmount, releasedAmount, status, purpose], i) => ({
  allotmentNo: `ALT-2026-${String(i + 1).padStart(3, "0")}`,
  date,
  allotmentClass,
  uacsMajor,
  objectOfExpenditure,
  allottee,
  allotmentAmount: Math.round(allotmentAmount),
  subAllotmentAmount: Math.round(subAllotmentAmount),
  releasedAmount: Math.round(releasedAmount),
  status,
  purpose,
}));

/** FY 2026 appropriations behind the "% of Appropriations" figure in the mockup (₱420M = 84%). */
export const LASA_APPROPRIATIONS = 500 * M;

export const LASA_UACS_LABELS: Record<string, string> = {
  "501": "Personnel Services",
  "502": "MOOE",
  "504": "Financial Expenses",
  "506": "Capital Outlay / Infrastructure",
};
