import type { SaaodbRow } from "@/features/bfars-reporting/saaodb/types";

const M = 1_000_000;

/**
 * Lines from MPC_BFARS2_SAAODB_Sample_Q1_2026.xlsx (illustrative sample, FY 2026 Q1).
 * Remarks follow the dashboard mockup. Each line is split across offices (shares
 * below) so the Department/Office filter has data; the splits add back to the workbook.
 */
export const SAAODB_LINES: (SaaodbRow & { offices: [office: string, share: number][] })[] = [
  { allotmentClass: "RAOPS", uacsMajor: "501", objectOfExpenditure: "Personnel Services", appropriations: 100 * M, allotments: 90 * M, obligations: 80 * M, disbursements: 70 * M, remarks: "On Track",
    offices: [["Academic Affairs", 0.55], ["Administrative Services", 0.25], ["Finance Office", 0.2]] },
  { allotmentClass: "RAOPS", uacsMajor: "502", objectOfExpenditure: "Maintenance and Other Operating Expenses", appropriations: 60 * M, allotments: 50 * M, obligations: 40 * M, disbursements: 30 * M, remarks: "On Track",
    offices: [["Administrative Services", 0.5], ["Academic Affairs", 0.3], ["Finance Office", 0.2]] },
  { allotmentClass: "RAOPS", uacsMajor: "503", objectOfExpenditure: "Financial Expenses", appropriations: 10 * M, allotments: 10 * M, obligations: 5 * M, disbursements: 4 * M, remarks: "Monitor",
    offices: [["Finance Office", 1]] },
  { allotmentClass: "RAOMO", uacsMajor: "502", objectOfExpenditure: "Maintenance and Other Operating Expenses", appropriations: 100 * M, allotments: 80 * M, obligations: 60 * M, disbursements: 48 * M, remarks: "On Track",
    offices: [["Academic Affairs", 0.4], ["Administrative Services", 0.35], ["Research Office", 0.15], ["Extension Office", 0.1]] },
  { allotmentClass: "RAOMO", uacsMajor: "504", objectOfExpenditure: "Capital Outlay", appropriations: 20 * M, allotments: 10 * M, obligations: 8 * M, disbursements: 5 * M, remarks: "Monitor",
    offices: [["Administrative Services", 0.6], ["Academic Affairs", 0.4]] },
  { allotmentClass: "RAOCO", uacsMajor: "504", objectOfExpenditure: "Capital Outlay", appropriations: 100 * M, allotments: 90 * M, obligations: 60 * M, disbursements: 35 * M, remarks: "Monitor",
    offices: [["Administrative Services", 0.5], ["Research Office", 0.3], ["Academic Affairs", 0.2]] },
  { allotmentClass: "RAOCO", uacsMajor: "506", objectOfExpenditure: "Infrastructure Outlay", appropriations: 40 * M, allotments: 30 * M, obligations: 17 * M, disbursements: 9 * M, remarks: "Monitor",
    offices: [["Administrative Services", 1]] },
  { allotmentClass: "RAOFE", uacsMajor: "505", objectOfExpenditure: "Other Financial Expenses", appropriations: 70 * M, allotments: 60 * M, obligations: 40 * M, disbursements: 39 * M, remarks: "On Track",
    offices: [["Finance Office", 0.7], ["Extension Office", 0.3]] },
];

export const UACS_MAJOR_LABELS: Record<string, string> = {
  "501": "Personnel Services",
  "502": "MOOE",
  "503": "Financial Expenses",
  "504": "Capital Outlay",
  "505": "Other Financial Expenses",
  "506": "Infrastructure Outlay",
};
