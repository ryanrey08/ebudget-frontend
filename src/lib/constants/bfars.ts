export interface BfarsReportMeta {
  /** URL segment under /bfars-reporting, e.g. "bfars-1" */
  id: string;
  number: number;
  code: string;
  title: string;
}

/** Report titles follow the agency's BFARS sample workbooks (FY 2026 Q1). */
export const BFARS_REPORTS: BfarsReportMeta[] = [
  { id: "bfars-1", number: 1, code: "QPRO", title: "Quarterly Physical Report of Operations" },
  {
    id: "bfars-2",
    number: 2,
    code: "SAAODB",
    title: "Statement of Appropriations, Allotments, Obligations, Disbursements and Balances",
  },
  {
    id: "bfars-3",
    number: 3,
    code: "SAAODBOE",
    title: "Summary of Appropriations, Allotments, Obligations, Disbursements and Balances by Object of Expenditures",
  },
  { id: "bfars-4", number: 4, code: "LASA", title: "List of Allotments and Sub-Allotments" },
  {
    id: "bfars-5",
    number: 5,
    code: "SODLBIAFT",
    title: "Statement of Obligations, Disbursements, Liquidations and Balances from Inter-Agency Fund Transfers",
  },
  {
    id: "bfars-6",
    number: 6,
    code: "SABUDB",
    title: "Statement of Approved Budget, Utilizations, Disbursements and Balances",
  },
  {
    id: "bfars-7",
    number: 7,
    code: "SABUDBOE",
    title: "Summary of Approved Budget, Utilizations, Disbursements and Balances by Object of Expenditures",
  },
  { id: "bfars-8", number: 8, code: "AUO", title: "Aging of Unpaid Obligations" },
  { id: "bfars-9", number: 9, code: "MRD", title: "Monthly Report of Disbursement" },
  { id: "bfars-10", number: 10, code: "QRROR", title: "Quarterly Report of Revenue and Other Receipts" },
  {
    id: "bfars-11",
    number: 11,
    code: "SABUDBTR",
    title: "Statement of Approved Budget, Utilizations, Disbursements and Balances for Trust Receipts",
  },
];

export function getBfarsReport(id: string) {
  return BFARS_REPORTS.find((r) => r.id === id);
}
