import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { ObjectClass, SaaodboeRow } from "@/features/bfars-reporting/saaodboe/types";

const M = 1_000_000;

/**
 * Lines from MPC_BFARS3_SAAODBOE_Sample_Q1_2026.xlsx (illustrative sample, FY 2026 Q1).
 * UACS codes and object classes follow the BFARS 3 report mockup (PS 501, MOOE 502,
 * CO 503, FE 504, Others 505).
 */
export const SAAODBOE_LINES: SaaodboeRow[] = [
  { uacsCode: "50101", objectClass: "PS", objectOfExpenditure: "Salaries and Wages", appropriations: 150 * M, allotments: 135 * M, obligations: 120 * M, disbursements: 110 * M },
  { uacsCode: "50102", objectClass: "PS", objectOfExpenditure: "Other Compensation", appropriations: 30 * M, allotments: 25 * M, obligations: 25 * M, disbursements: 25 * M },
  { uacsCode: "50103", objectClass: "PS", objectOfExpenditure: "Personnel Benefit Contributions", appropriations: 20 * M, allotments: 20 * M, obligations: 15 * M, disbursements: 15 * M },
  { uacsCode: "50201", objectClass: "MOOE", objectOfExpenditure: "Travel Expenses", appropriations: 20 * M, allotments: 18 * M, obligations: 15 * M, disbursements: 10 * M },
  { uacsCode: "50202", objectClass: "MOOE", objectOfExpenditure: "Training and Scholarship Expenses", appropriations: 15 * M, allotments: 12 * M, obligations: 10 * M, disbursements: 7 * M },
  { uacsCode: "50203", objectClass: "MOOE", objectOfExpenditure: "Supplies and Materials Expenses", appropriations: 60 * M, allotments: 50 * M, obligations: 40 * M, disbursements: 28 * M },
  { uacsCode: "50204", objectClass: "MOOE", objectOfExpenditure: "Utility Expenses", appropriations: 25 * M, allotments: 20 * M, obligations: 18 * M, disbursements: 12 * M },
  { uacsCode: "50299", objectClass: "MOOE", objectOfExpenditure: "Other Maintenance and Operating Expenses", appropriations: 30 * M, allotments: 20 * M, obligations: 17 * M, disbursements: 13 * M },
  { uacsCode: "50301", objectClass: "CO", objectOfExpenditure: "Land and Land Improvements", appropriations: 10 * M, allotments: 8 * M, obligations: 5 * M, disbursements: 2 * M },
  { uacsCode: "50302", objectClass: "CO", objectOfExpenditure: "Buildings and Other Structures", appropriations: 40 * M, allotments: 35 * M, obligations: 20 * M, disbursements: 8 * M },
  { uacsCode: "50303", objectClass: "CO", objectOfExpenditure: "Machinery and Equipment Outlay", appropriations: 25 * M, allotments: 22 * M, obligations: 12 * M, disbursements: 4 * M },
  { uacsCode: "50399", objectClass: "CO", objectOfExpenditure: "Other Capital Outlay", appropriations: 5 * M, allotments: 5 * M, obligations: 3 * M, disbursements: 1 * M },
  { uacsCode: "50401", objectClass: "FE", objectOfExpenditure: "Interest Expenses", appropriations: 10 * M, allotments: 8 * M, obligations: 5 * M, disbursements: 2.5 * M },
  { uacsCode: "50402", objectClass: "FE", objectOfExpenditure: "Bank Charges and Other Financial Expenses", appropriations: 10 * M, allotments: 7 * M, obligations: 5 * M, disbursements: 2.5 * M },
  { uacsCode: "50599", objectClass: "Others", objectOfExpenditure: "Others", appropriations: 50 * M, allotments: 35 * M, obligations: 0, disbursements: 0 },
];

/** Remarks per object class, as shown in the BFARS 3 dashboard mockup. */
export const SAAODBOE_REMARKS: Record<ObjectClass, string> = { PS: "On Track", MOOE: "Monitor", CO: "Needs Attention", FE: "Monitor", Others: "For Allotment" };

/**
 * Sample split of each object class across offices and allotment classes so the
 * Department/Office and Allotment Class filters have data; the shares add back to the workbook.
 */
export const SAAODBOE_SPLITS: Record<ObjectClass, { offices: [string, number][]; classes: [AllotmentClassCode, number][] }> = {
  PS: { offices: [["Academic Affairs", 0.55], ["Administrative Services", 0.25], ["Finance Office", 0.2]], classes: [["RAOPS", 1]] },
  MOOE: { offices: [["Administrative Services", 0.4], ["Academic Affairs", 0.3], ["Research Office", 0.15], ["Extension Office", 0.1], ["Finance Office", 0.05]], classes: [["RAOMO", 0.85], ["RAOPS", 0.15]] },
  CO: { offices: [["Administrative Services", 0.6], ["Research Office", 0.25], ["Academic Affairs", 0.15]], classes: [["RAOCO", 1]] },
  FE: { offices: [["Finance Office", 1]], classes: [["RAOFE", 1]] },
  Others: { offices: [["Administrative Services", 0.5], ["Academic Affairs", 0.5]], classes: [["RAOMO", 0.6], ["RAOCO", 0.4]] },
};
