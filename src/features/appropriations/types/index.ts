import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { PageParams } from "@/types/api";

/** GAA = General Appropriations Act; Supplemental = supplemental appropriation. */
export type AppropriationType = "GAA" | "Supplemental";
export type AppropriationStatus = "Draft" | "Unreleased" | "Active" | "Released";
export const APPROPRIATION_CATEGORIES = ["Permanent", "Automatic Appropriations", "Special Purpose Funds"] as const;
export type AppropriationCategory = (typeof APPROPRIATION_CATEGORIES)[number];

export interface AppropriationDocument {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy?: string;
  /** Optional classification and note (used by allotment-class document uploads). */
  category?: string;
  description?: string;
  /** Link to view/download the file; absent for sample records without stored content. */
  url?: string;
}

export interface Appropriation {
  id: string;
  referenceNo: string;
  fiscalYear: number;
  title: string;
  type: AppropriationType;
  /** Present on records loaded from the GAA; manually created records may not have one. */
  category?: AppropriationCategory;
  orgCode: string;
  office: string;
  program: string;
  papCode: string;
  uacsCode: string;
  /** Object of expenditure / item description. */
  objectOfExpenditure: string;
  fundSource: string;
  allotmentClass: AllotmentClassCode;
  amount: number;
  /** Total allotments issued against this appropriation. */
  allotted: number;
  /** Amount released through those allotments. */
  released: number;
  level: string;
  gaaReference: string;
  gaaPart: string;
  effectivityDate: string;
  expiryDate?: string;
  remarks: string;
  documents: AppropriationDocument[];
  status: AppropriationStatus;
  createdAt: string;
}

export interface AppropriationListParams extends PageParams {
  fiscalYear: number;
  allotmentClass?: AllotmentClassCode | "";
  status?: AppropriationStatus | "";
  fundSource?: string;
  program?: string;
  category?: AppropriationCategory | "";
}

export interface AppropriationSummary {
  fiscalYear: number;
  totalAmount: number;
  count: number;
  released: number;
  unreleased: number;
  byClass: { allotmentClass: AllotmentClassCode; amount: number }[];
  byFundSource: { code: string; name: string; amount: number }[];
  byCategory: Record<AppropriationCategory, number>;
}

/** Choice lists used by the appropriation form and filters. */
export interface AppropriationLookups {
  offices: { orgCode: string; name: string }[];
  programs: string[];
  fundSources: { code: string; name: string }[];
  levels: string[];
  uacsCodes: { code: string; description: string; allotmentClass: AllotmentClassCode }[];
}

export interface CreateAppropriationRequest {
  fiscalYear: number;
  title: string;
  type: AppropriationType;
  orgCode: string;
  program: string;
  uacsCode: string;
  objectOfExpenditure: string;
  fundSource: string;
  allotmentClass: AllotmentClassCode;
  amount: number;
  level: string;
  gaaReference: string;
  gaaPart: string;
  effectivityDate: string;
  expiryDate?: string;
  remarks: string;
  documentIds: string[];
  /** true saves a draft that skips required-field checks except the title. */
  draft: boolean;
}

/* ---------- GAA upload & import ---------- */

export type GaaBatchStatus = "Uploaded" | "Validated" | "With Errors" | "Imported";

export interface GaaUploadBatch {
  id: string;
  fileName: string;
  fileSize: number;
  fiscalYear: number;
  uploadedAt: string;
  uploadedBy: string;
  rowCount: number;
  errorCount: number;
  warningCount: number;
  totalAmount: number;
  status: GaaBatchStatus;
  importedAt?: string;
}

/** eBudget fields a GAA file column can be mapped to. */
export type GaaFieldKey =
  | "fiscalYear"
  | "orgCode"
  | "office"
  | "uacsObjectCode"
  | "description"
  | "amount"
  | "fundSource"
  | "allotmentClass"
  | "program"
  | "papCode"
  | "appropriationType"
  | "remarks";

/** A column found in the uploaded file (spreadsheet letter, header text, first value). */
export interface GaaSourceColumn {
  key: string;
  header: string;
  sample: string;
}

/** One data row of the uploaded file, parsed into eBudget fields. */
export interface GaaRow {
  rowNo: number;
  fiscalYear: number;
  orgCode: string;
  office: string;
  uacsObjectCode: string;
  description: string;
  amount: number;
  fundSource: string;
  allotmentClass: string;
  program: string;
  papCode: string;
  appropriationType: string;
  remarks: string;
  errors: string[];
  warnings: string[];
}

export type GaaRowStatus = "valid" | "warning" | "error";

export interface UploadGaaRequest {
  file: File;
  fiscalYear: number;
}

export interface GaaIssueCount {
  message: string;
  count: number;
}

export interface GaaValidationSummary {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  duplicates: number;
  topErrors: GaaIssueCount[];
  topWarnings: GaaIssueCount[];
}

export type GaaMapping = Record<GaaFieldKey, string>;

export interface GaaImportSettings {
  fiscalYear: number;
  importType: "create" | "update";
  dataSheet: string;
  firstDataRow: number;
  skipRowsWithErrors: boolean;
  updateExisting: boolean;
}

export interface ImportGaaRequest {
  id: string;
  mapping: GaaMapping;
  settings: GaaImportSettings;
}

export type GaaImportRowStatus = "Imported" | "Updated" | "With Warning" | "Failed" | "Skipped";

export interface GaaImportRowResult {
  rowNo: number;
  status: GaaImportRowStatus;
  remarks: string;
}

export interface ImportGaaResponse {
  batch: GaaUploadBatch;
  importedAt: string;
  importedBy: string;
  total: number;
  importedCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  totalAmount: number;
  results: GaaImportRowResult[];
}
