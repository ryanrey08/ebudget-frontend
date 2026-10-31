import type { GaaFieldKey, GaaImportSettings, GaaMapping, GaaRow, GaaRowStatus, GaaSourceColumn } from "../types";

export interface GaaFieldDef {
  key: GaaFieldKey;
  label: string;
  dataType: "Text" | "Number";
  required: boolean;
  description: string;
  validValues: string;
  example: string;
  /** Header spellings recognised by Auto Map (compared case- and punctuation-insensitively). */
  aliases: string[];
}

/**
 * eBudget fields accepted from a GAA file. Required flags and value checks
 * mirror the frontend format validation only; the backend owns business rules.
 */
export const GAA_FIELDS: GaaFieldDef[] = [
  { key: "orgCode", label: "Organization Code", dataType: "Text", required: false, description: "Code of the agency or operating unit.", validValues: "Any text", example: "08 011 0000000", aliases: ["org code", "organization code", "orgcode"] },
  { key: "office", label: "Organization/Office", dataType: "Text", required: true, description: "Name of the agency or office the appropriation belongs to.", validValues: "Any text", example: "Marikina Polytechnic College", aliases: ["organization / office", "organization/office", "office", "organization"] },
  { key: "uacsObjectCode", label: "UACS Code", dataType: "Text", required: true, description: "Unified Accounts Code Structure object code of the budget item.", validValues: "8 digits", example: "50201010", aliases: ["uacs code", "uacs object code", "object code"] },
  { key: "description", label: "Description", dataType: "Text", required: true, description: "Object of expenditure or item description.", validValues: "Any non-empty text", example: "Salaries and Wages - Permanent", aliases: ["description", "object of expenditure / description", "object of expenditure"] },
  { key: "amount", label: "Appropriation Amount", dataType: "Number", required: true, description: "Appropriation amount in Philippine pesos.", validValues: "Number greater than zero", example: "50,000,000.00", aliases: ["appropriation", "appropriation amount", "appropriation amount (php)", "amount"] },
  { key: "fundSource", label: "Fund Source", dataType: "Text", required: true, description: "Fund source code of the appropriation.", validValues: "Any non-empty text", example: "101", aliases: ["fund source", "fund"] },
  { key: "allotmentClass", label: "Allotment Class", dataType: "Text", required: true, description: "Registry the appropriation is allotted under.", validValues: "RAOPS, RAOMO, RAOCO or RAOFE", example: "RAOPS", aliases: ["allotment class", "class"] },
  { key: "program", label: "Program/Activity", dataType: "Text", required: false, description: "Program, activity or project (PAP) name.", validValues: "Any text", example: "General Administration", aliases: ["program/activity", "program / activity / project", "program", "pap name"] },
  { key: "papCode", label: "PAP Code", dataType: "Text", required: false, description: "Program, activity or project code.", validValues: "Any text", example: "PAP-001", aliases: ["pap / uacs code", "pap code", "pap"] },
  { key: "appropriationType", label: "Appropriation Type", dataType: "Text", required: false, description: "New, Continuing or Supplemental appropriation.", validValues: "Any text", example: "New", aliases: ["appropriation type", "type"] },
  { key: "fiscalYear", label: "Fiscal Year", dataType: "Number", required: false, description: "Fiscal year of the record. When mapped it must match the import fiscal year.", validValues: "Four-digit year", example: "2026", aliases: ["fiscal year", "fy", "year"] },
  { key: "remarks", label: "Remarks", dataType: "Text", required: false, description: "Free-text notes carried into the appropriation record.", validValues: "Any text", example: "-", aliases: ["remarks", "notes"] },
];

export const REQUIRED_FIELDS = GAA_FIELDS.filter((f) => f.required).map((f) => f.key);

export const emptyMapping = (): GaaMapping =>
  Object.fromEntries(GAA_FIELDS.map((f) => [f.key, ""])) as GaaMapping;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Maps each source column to the eBudget field whose label or alias matches its header. */
export function autoMap(columns: GaaSourceColumn[]): GaaMapping {
  const mapping = emptyMapping();
  for (const field of GAA_FIELDS) {
    const names = [field.label, ...field.aliases].map(normalize);
    const match = columns.find(
      (c) => names.includes(normalize(c.header)) && !Object.values(mapping).includes(c.key),
    );
    if (match) mapping[field.key] = match.key;
  }
  return mapping;
}

export function missingRequired(mapping: GaaMapping) {
  return GAA_FIELDS.filter((f) => f.required && !mapping[f.key]);
}

export function rowStatus(row: GaaRow): GaaRowStatus {
  if (row.errors.length) return "error";
  if (row.warnings.length) return "warning";
  return "valid";
}

export function defaultImportSettings(fiscalYear: number): GaaImportSettings {
  return {
    fiscalYear,
    importType: "create",
    dataSheet: "GAA Upload",
    firstDataRow: 2,
    skipRowsWithErrors: true,
    updateExisting: false,
  };
}
