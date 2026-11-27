/**
 * Backend appropriation lines: /appropriations (AppropriationResource) and
 * the GAA upload: /appropriations/import/validate, /appropriations/imports
 * (GaaUploadReportResource, AppropriationImportResource). One row per line;
 * there is no parent record. The older `Appropriation` types in ./index.ts
 * belong to the demo data used by the dashboard, obligations and BFARS.
 */
import type { BackendPageQuery, IsoDate, IsoDateTime, PesoString, Ulid } from "@/types/backend";
import type { FiscalYearStatus } from "@/features/master-data/types";

export type AppropriationLevel = "agency" | "operating_unit";
export const APPROPRIATION_LEVELS: { value: AppropriationLevel; label: string }[] = [
  { value: "agency", label: "Agency" },
  { value: "operating_unit", label: "Operating Unit" },
];

export type AppropriationType = "gaa" | "supplemental" | "continuing" | "automatic" | "unprogrammed";
export const APPROPRIATION_TYPES: { value: AppropriationType; label: string }[] = [
  { value: "gaa", label: "General Appropriations Act (GAA)" },
  { value: "supplemental", label: "Supplemental Appropriations" },
  { value: "continuing", label: "Continuing Appropriations" },
  { value: "automatic", label: "Automatic Appropriations" },
  { value: "unprogrammed", label: "Unprogrammed Appropriations" },
];

/** The line's allotment that isn't cancelled, as embedded in a line. */
export interface LineAllotmentSummary {
  id: Ulid;
  allotment_no: string;
  status: string;
  status_label: string;
  amount: PesoString;
  released_amount: PesoString;
  pending_amount: PesoString;
  unreleased_amount: PesoString;
  next_tranche_no: number | null;
  next_tranche_label: string | null;
  purpose: string;
}

export interface CodeRef {
  id: number;
  code: string;
  description: string;
}

export interface AppropriationLine {
  id: number;
  /** APP-2026-001, assigned per fiscal year by the database. */
  appropriation_no: string;
  fiscal_year_id: Ulid;
  fiscal_year?: { id: Ulid; year: number; name: string; status: FiscalYearStatus };
  organization_id: number;
  organization?: { id: number; code: string; name: string };
  title: string | null;
  level: AppropriationLevel;
  level_label: string;
  type: AppropriationType;
  type_label: string;
  legal_reference: string | null;
  effectivity_date: IsoDate;
  expiry_date: IsoDate | null;
  prexc_item_id: number;
  prexc_item?: CodeRef;
  uacs_object_id: number;
  uacs_object?: CodeRef;
  fund_source_id: number;
  fund_source?: CodeRef;
  allotment_class_id: number;
  allotment_class?: CodeRef;
  amount: PesoString;
  allotted_amount?: PesoString;
  unallotted_amount?: PesoString;
  allotment?: LineAllotmentSummary | null;
  remarks: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AppropriationLineQuery extends BackendPageQuery {
  fiscal_year_id?: Ulid;
  organization_id?: number;
  level?: AppropriationLevel;
  type?: AppropriationType;
  prexc_item_id?: number;
  uacs_object_id?: number;
  fund_source_id?: number;
  allotment_class_id?: number;
  /** 1: lines that can still take a release; 0: fully released ones. */
  has_balance?: 0 | 1;
  search?: string;
}

/** POST body (all required except the optional fields) and PATCH body (any subset). */
export interface AppropriationLineInput {
  fiscal_year_id?: Ulid;
  organization_id?: number;
  title?: string | null;
  level?: AppropriationLevel;
  type?: AppropriationType;
  legal_reference?: string | null;
  effectivity_date?: IsoDate;
  expiry_date?: IsoDate | null;
  prexc_item_id?: number;
  uacs_object_id?: number;
  fund_source_id?: number;
  allotment_class_id?: number;
  /** Pesos as a string, no thousands separators. */
  amount?: PesoString;
  remarks?: string | null;
}

/* ── GAA upload ─────────────────────────────────────────────────────────── */

/** Template columns A–L, named by field (GaaUploadColumn). */
export const GAA_CELL_FIELDS = [
  "fiscal_year",
  "organization_code",
  "organization_name",
  "uacs_object_code",
  "uacs_object_description",
  "amount",
  "fund_source_code",
  "allotment_class",
  "program_name",
  "prexc_code",
  "appropriation_type",
  "remarks",
] as const;
export type GaaCellField = (typeof GAA_CELL_FIELDS)[number];
export type GaaCells = Partial<Record<GaaCellField, string | null>>;

export const GAA_CELL_HEADINGS: Record<GaaCellField, { column: string; heading: string; required: boolean }> = {
  fiscal_year: { column: "A", heading: "Fiscal Year", required: true },
  organization_code: { column: "B", heading: "Org Code", required: true },
  organization_name: { column: "C", heading: "Organization / Office", required: false },
  uacs_object_code: { column: "D", heading: "UACS Object Code", required: true },
  uacs_object_description: { column: "E", heading: "Object of Expenditure / Description", required: false },
  amount: { column: "F", heading: "Appropriation Amount (PHP)", required: true },
  fund_source_code: { column: "G", heading: "Fund Source", required: true },
  allotment_class: { column: "H", heading: "Allotment Class", required: true },
  program_name: { column: "I", heading: "Program / Activity / Project", required: false },
  prexc_code: { column: "J", heading: "PAP / UACS Code", required: true },
  appropriation_type: { column: "K", heading: "Appropriation Type", required: true },
  remarks: { column: "L", heading: "Remarks", required: false },
};

export interface GaaRowIssue {
  row: number;
  column: string;
  field: GaaCellField | string;
  heading: string;
  message: string;
}

export interface GaaReportLine {
  row: number;
  valid: boolean;
  /** Each cell as entered (trimmed text, null if empty): edit these and send them back. */
  cells: GaaCells;
  fiscal_year: number | null;
  fiscal_year_id: Ulid | null;
  organization_code: string | null;
  organization_name: string | null;
  organization_id: number | null;
  uacs_object_code: string | null;
  uacs_object_description: string | null;
  uacs_object_id: number | null;
  amount: PesoString | null;
  fund_source_code: string | null;
  fund_source_id: number | null;
  allotment_class: string | null;
  allotment_class_id: number | null;
  program_name: string | null;
  prexc_code: string | null;
  prexc_item_id: number | null;
  type: AppropriationType | null;
  remarks: string | null;
}

/** 200 from POST /appropriations/import/validate (nothing saved). */
export interface GaaValidationReport {
  valid: boolean;
  summary: { rows: number; valid_rows: number; invalid_rows: number; total_amount: PesoString };
  errors: GaaRowIssue[];
  lines: GaaReportLine[];
}

/** POST /appropriations/imports */
export interface GaaImportInput {
  level: AppropriationLevel;
  legal_reference?: string | null;
  title?: string | null;
  effectivity_date?: IsoDate | null;
  expiry_date?: IsoDate | null;
  source_name?: string | null;
  lines: { row?: number; cells: GaaCells }[];
}

export type GaaImportStatus = "queued" | "processing" | "completed" | "failed";

export interface GaaImport {
  id: Ulid;
  status: GaaImportStatus;
  status_label: string;
  source_name: string | null;
  level: AppropriationLevel;
  level_label: string;
  title: string | null;
  legal_reference: string | null;
  effectivity_date: IsoDate | null;
  expiry_date: IsoDate | null;
  uploaded_by: Ulid;
  row_count: number | null;
  imported_count: number | null;
  total_amount: PesoString | null;
  error_count: number | null;
  errors: (GaaRowIssue & { line: number })[] | null;
  failure_message: string | null;
  started_at: IsoDateTime | null;
  finished_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}
