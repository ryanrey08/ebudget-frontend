const M = 1_000_000;

/** One trust receipt fund of MPC_BFARS11_SABUDBTR_Sample_Q1_2026 (illustrative sample; UACS codes are placeholders). */
export interface SabudbtrFund {
  fund: string;
  uacsCode: string;
  uacsDescription: string;
  approvedBudget: number;
  /** January, February, March utilizations and disbursements ("Monthly Utilization" sheet). */
  utilizations: [number, number, number];
  disbursements: [number, number, number];
  /** Illustrative split of the fund into activities and offices (the references have neither); shares add to 1. */
  activities: [activity: string, office: string, share: number][];
}

/**
 * Q1 FY 2026: approved budget ₱120M, utilizations ₱95M (28.5 / 30.4 / 36.1M), disbursements ₱83M (24.9 / 26.56 / 31.54M).
 * The mockups' ₱85M disbursement total does not equal their own rows (36 + 22 + 12 + 8 + 5 = 83), so the workbook wins.
 */
export const SABUDBTR_FUNDS: SabudbtrFund[] = [
  {
    fund: "Student Fees",
    uacsCode: "4-01-01-01",
    uacsDescription: "Tuition and Other School Fees",
    approvedBudget: 50 * M,
    utilizations: [12 * M, 12.8 * M, 15.2 * M],
    disbursements: [10.8 * M, 11.52 * M, 13.68 * M],
    activities: [["Instruction and Laboratory Fees", "Academic Affairs", 0.6], ["Student Development and Services", "Student Affairs", 0.4]],
  },
  {
    fund: "Research Income",
    uacsCode: "4-02-01-01",
    uacsDescription: "Research Grants and Aid",
    approvedBudget: 30 * M,
    utilizations: [7.5 * M, 8 * M, 9.5 * M],
    disbursements: [6.6 * M, 7.04 * M, 8.36 * M],
    activities: [["Externally Funded Research Projects", "Research Office", 0.7], ["Research Publication and Dissemination", "Research Office", 0.3]],
  },
  {
    fund: "Extension Programs",
    uacsCode: "4-02-02-01",
    uacsDescription: "Extension Services Income",
    approvedBudget: 20 * M,
    utilizations: [4.5 * M, 4.8 * M, 5.7 * M],
    disbursements: [3.6 * M, 3.84 * M, 4.56 * M],
    activities: [["Community Extension Projects", "Extension Office", 0.6], ["Technical-Vocational Training", "Extension Office", 0.4]],
  },
  {
    fund: "Other Income",
    uacsCode: "4-02-99-01",
    uacsDescription: "Miscellaneous Income",
    approvedBudget: 15 * M,
    utilizations: [3 * M, 3.2 * M, 3.8 * M],
    disbursements: [2.4 * M, 2.56 * M, 3.04 * M],
    activities: [["Income-Generating Projects", "Administrative Services", 0.6], ["Rentals and Other Fees", "Finance Office", 0.4]],
  },
  {
    fund: "Trust Liabilities",
    uacsCode: "4-03-01-01",
    uacsDescription: "Deposits / Trust Liabilities",
    approvedBudget: 5 * M,
    utilizations: [1.5 * M, 1.6 * M, 1.9 * M],
    disbursements: [1.5 * M, 1.6 * M, 1.9 * M],
    activities: [["Guaranty and Performance Deposits", "Finance Office", 1]],
  },
];

/**
 * April–December have no sample data: each month utilizes this fraction of the fund's average Q1 month
 * (capped at the approved budget) and disburses at the fund's Q1 disbursement rate.
 */
export const SABUDBTR_LATER_MONTH_FACTOR = [0.09, 0.08, 0.1, 0.07, 0.08, 0.09, 0.06, 0.08, 0.1];
