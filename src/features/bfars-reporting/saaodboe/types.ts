import type { Quarter } from "../qpro/types";
import type { SaaodbParams, SaaodbSignatory } from "../saaodb/types";

/** BFARS 3 uses the same filters as BFARS 2 (empty strings mean "All"). */
export type SaaodboeParams = SaaodbParams;

/** Object classes in the order of the SAAODBOE report. */
export type ObjectClass = "PS" | "MOOE" | "CO" | "FE" | "Others";

/** One object of expenditure line, columns as in the SAAODBOE sample workbook. */
export interface SaaodboeRow {
  uacsCode: string;
  objectClass: ObjectClass;
  objectOfExpenditure: string;
  appropriations: number;
  allotments: number;
  obligations: number;
  disbursements: number;
}

export interface SaaodboeReport {
  fiscalYear: number;
  quarter: Quarter;
  period: string;
  asOf: string;
  agency: string;
  fundSource: string;
  rows: SaaodboeRow[];
  /** Status label per object class shown in the Remarks column. */
  remarks: Partial<Record<ObjectClass, string>>;
  signatories: SaaodbSignatory[];
  options: { departments: string[]; uacsMajors: { code: string; label: string }[] };
}
