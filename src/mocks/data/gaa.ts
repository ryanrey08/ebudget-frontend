import type { GaaRow } from "@/features/appropriations/types";

/** Column order of the eBudget GAA upload template (CSV / XLSX). */
export const GAA_TEMPLATE_HEADERS = [
  "Fiscal Year",
  "Org Code",
  "Organization / Office",
  "UACS Object Code",
  "Object of Expenditure / Description",
  "Appropriation Amount (PHP)",
  "Fund Source",
  "Allotment Class",
  "Program / Activity / Project",
  "PAP / UACS Code",
  "Appropriation Type",
  "Remarks",
] as const;

export type RowSeed = Omit<GaaRow, "rowNo" | "errors" | "warnings" | "fiscalYear">;

const ORG = { orgCode: "08 011 0000000", office: "Marikina Polytechnic College" };

/** Rows from the agency's GAA upload template sample. */
export const GAA_SAMPLE_ROWS: RowSeed[] = [
  { ...ORG, uacsObjectCode: "50201010", description: "Salaries and Wages - Permanent", amount: 50_000_000, fundSource: "101", allotmentClass: "RAOPS", program: "General Administration", papCode: "PAP-001", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "50201020", description: "Salaries and Wages - Casual", amount: 10_000_000, fundSource: "101", allotmentClass: "RAOPS", program: "General Administration", papCode: "PAP-001", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "50203010", description: "Personnel Economic Relief Allowance (PERA)", amount: 5_000_000, fundSource: "101", allotmentClass: "RAOPS", program: "General Administration", papCode: "PAP-001", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "50204010", description: "Representation Allowance (RA)", amount: 2_000_000, fundSource: "101", allotmentClass: "RAOPS", program: "General Administration", papCode: "PAP-001", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "50205010", description: "Transportation Allowance (TA)", amount: 1_500_000, fundSource: "101", allotmentClass: "RAOPS", program: "General Administration", papCode: "PAP-001", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "50299990", description: "Other Personnel Benefits", amount: 3_000_000, fundSource: "101", allotmentClass: "RAOPS", program: "General Administration", papCode: "PAP-001", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "20101010", description: "Office Supplies Expenses", amount: 8_000_000, fundSource: "101", allotmentClass: "RAOMO", program: "Support to Operations", papCode: "PAP-002", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "20102010", description: "Information Technology Supplies", amount: 5_000_000, fundSource: "101", allotmentClass: "RAOMO", program: "Support to Operations", papCode: "PAP-002", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "20201010", description: "Training Expenses", amount: 2_500_000, fundSource: "101", allotmentClass: "RAOMO", program: "Support to Operations", papCode: "PAP-002", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "30101010", description: "Buildings and Other Structures", amount: 25_000_000, fundSource: "151", allotmentClass: "RAOCO", program: "Infrastructure Development", papCode: "PAP-003", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "40101010", description: "Financial Expenses", amount: 1_000_000, fundSource: "101", allotmentClass: "RAOFE", program: "Financial Operations", papCode: "PAP-004", appropriationType: "New", remarks: "" },
];

/** Extra rows used to demonstrate validation errors and a duplicate warning. */
export const GAA_INVALID_SAMPLE_ROWS: RowSeed[] = [
  { ...ORG, uacsObjectCode: "5020", description: "Communication Expenses", amount: 1_200_000, fundSource: "101", allotmentClass: "RAOMO", program: "Support to Operations", papCode: "PAP-002", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "20201020", description: "Seminar Expenses", amount: 900_000, fundSource: "", allotmentClass: "RAOMO", program: "Support to Operations", papCode: "PAP-002", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "30101020", description: "", amount: 4_000_000, fundSource: "151", allotmentClass: "RAOX", program: "Infrastructure Development", papCode: "PAP-003", appropriationType: "New", remarks: "" },
  { ...ORG, uacsObjectCode: "20101010", description: "Office Supplies Expenses", amount: 8_000_000, fundSource: "101", allotmentClass: "RAOMO", program: "Support to Operations", papCode: "PAP-002", appropriationType: "New", remarks: "" },
];

/** Spreadsheet letters + headers of the template, used as the mock file's columns. */
export const GAA_TEMPLATE_COLUMNS = GAA_TEMPLATE_HEADERS.map((header, i) => ({
  key: String.fromCharCode(65 + i),
  header,
}));

export interface GaaSeedBatch {
  id: string;
  fileName: string;
  fileSize: number;
  fiscalYear: number;
  uploadedAt: string;
  uploadedBy: string;
  imported: boolean;
  rows: RowSeed[];
}

export const GAA_SEED_BATCHES: GaaSeedBatch[] = [
  {
    id: "gaa-2026-001",
    fileName: "GAA_MPC_FY2026.xlsx",
    fileSize: 48_230,
    fiscalYear: 2026,
    uploadedAt: "2026-01-04T09:12:00.000Z",
    uploadedBy: "Juan Dela Cruz",
    imported: true,
    rows: GAA_SAMPLE_ROWS,
  },
  {
    id: "gaa-2026-002",
    fileName: "GAA_MPC_FY2026_Supplemental.xlsx",
    fileSize: 21_904,
    fiscalYear: 2026,
    uploadedAt: "2026-10-18T14:41:00.000Z",
    uploadedBy: "Juan Dela Cruz",
    imported: false,
    rows: [...GAA_SAMPLE_ROWS, ...GAA_INVALID_SAMPLE_ROWS],
  },
];
