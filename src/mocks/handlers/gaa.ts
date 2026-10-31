import { ENDPOINTS } from "@/lib/api/endpoints";
import type {
  Appropriation,
  GaaImportRowResult,
  GaaRow,
  GaaSourceColumn,
  GaaUploadBatch,
  GaaValidationSummary,
  ImportGaaRequest,
  ImportGaaResponse,
} from "@/features/appropriations/types";
import { REQUIRED_FIELDS } from "@/features/appropriations/gaa/fields";
import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import { GAA_INVALID_SAMPLE_ROWS, GAA_SAMPLE_ROWS } from "../data/gaa";
import { db, getMockSessionUserName, nextSequence, seedRows, templateColumns } from "../services/db";
import { parseGaaCsv, summarizeGaaRows, validateGaaRows } from "../services/gaa-validation";
import { MockHttpError, route } from "../services/http";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED = [".xlsx", ".xls", ".csv"];

function findBatch(id: string) {
  const batch = db.gaaBatches.find((b) => b.id === id);
  if (!batch) throw new MockHttpError(404, "Upload not found.");
  return batch;
}

export const gaaHandlers = [
  route("GET", ENDPOINTS.gaa.uploads, (): GaaUploadBatch[] =>
    [...db.gaaBatches].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
  ),

  route("GET", "/gaa/uploads/:id", ({ params }): GaaUploadBatch => ({ ...findBatch(params.id) })),

  route("GET", "/gaa/uploads/:id/rows", ({ params }): GaaRow[] => {
    findBatch(params.id);
    return db.gaaRows[params.id] ?? [];
  }),

  route("GET", "/gaa/uploads/:id/columns", ({ params }): GaaSourceColumn[] => {
    findBatch(params.id);
    return db.gaaColumns[params.id] ?? [];
  }),

  route<FormData>("POST", ENDPOINTS.gaa.uploads, async ({ body }): Promise<GaaUploadBatch> => {
    const file = body.get("file");
    const fiscalYear = Number(body.get("fiscalYear"));
    if (!(file instanceof File)) throw new MockHttpError(400, "No file was uploaded.");
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.includes(ext)) throw new MockHttpError(415, "Only Excel (.xlsx, .xls) or .csv files are accepted.");
    if (file.size > MAX_FILE_SIZE) throw new MockHttpError(413, "File exceeds the 20 MB limit.");

    let rows: GaaRow[];
    let columns: GaaSourceColumn[];
    if (ext === ".csv") {
      // CSV files are parsed for real so the workflow can be tested end to end.
      try {
        ({ rows, columns } = parseGaaCsv(await file.text()));
      } catch (error) {
        throw new MockHttpError(422, error instanceof Error ? error.message : "Unable to read the CSV file.");
      }
      if (rows.length === 0) throw new MockHttpError(422, "The file has no data rows.");
    } else {
      // Spreadsheet parsing belongs to the backend; the mock returns the template sample rows.
      const seeds = file.name.toLowerCase().includes("error")
        ? [...GAA_SAMPLE_ROWS, ...GAA_INVALID_SAMPLE_ROWS]
        : GAA_SAMPLE_ROWS;
      rows = seedRows(seeds, fiscalYear);
      columns = templateColumns(seeds[0], fiscalYear);
    }

    const batch: GaaUploadBatch = {
      id: `gaa-${fiscalYear}-${Date.now().toString(36)}`,
      fileName: file.name,
      fileSize: file.size,
      fiscalYear,
      uploadedAt: new Date().toISOString(),
      uploadedBy: getMockSessionUserName(),
      rowCount: rows.length,
      errorCount: 0,
      warningCount: 0,
      totalAmount: rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0),
      status: "Uploaded",
    };
    db.gaaBatches.push(batch);
    db.gaaRows[batch.id] = rows;
    db.gaaColumns[batch.id] = columns;
    return batch;
  }),

  route("POST", "/gaa/uploads/:id/validate", ({ params }): GaaValidationSummary => {
    const batch = findBatch(params.id);
    const rows = validateGaaRows(db.gaaRows[batch.id] ?? [], batch.fiscalYear);
    db.gaaRows[batch.id] = rows;
    const summary = summarizeGaaRows(rows);
    batch.errorCount = summary.errors;
    batch.warningCount = summary.warnings;
    if (batch.status !== "Imported") batch.status = summary.errors ? "With Errors" : "Validated";
    return summary;
  }),

  route("GET", "/gaa/uploads/:id/import", ({ params }): ImportGaaResponse => {
    findBatch(params.id);
    const result = db.gaaResults[params.id];
    if (!result) throw new MockHttpError(404, "This file has not been imported yet.");
    return result;
  }),

  route<Omit<ImportGaaRequest, "id">>("POST", "/gaa/uploads/:id/import", ({ params, body }): ImportGaaResponse => {
    const batch = findBatch(params.id);
    if (batch.status === "Imported") throw new MockHttpError(409, "This file has already been imported.");
    if (batch.status === "Uploaded") throw new MockHttpError(409, "Validate the file before importing.");
    const missing = REQUIRED_FIELDS.filter((f) => !body.mapping[f]);
    if (missing.length) {
      throw new MockHttpError(422, `Map all required fields before importing (${missing.join(", ")}).`);
    }
    const { settings } = body;
    const rows = db.gaaRows[batch.id] ?? [];
    if (!settings.skipRowsWithErrors && rows.some((r) => r.errors.length)) {
      throw new MockHttpError(422, "The file has rows with errors. Fix them or enable “Skip rows with errors”.");
    }

    const results: GaaImportRowResult[] = [];
    let totalAmount = 0;
    for (const row of rows) {
      if (row.errors.length) {
        results.push({ rowNo: row.rowNo, status: "Failed", remarks: row.errors.join("; ") });
        continue;
      }
      const existing = db.appropriations.find(
        (a) => a.fiscalYear === settings.fiscalYear && a.uacsCode === row.uacsObjectCode,
      );
      if (existing && (settings.importType === "update" || settings.updateExisting)) {
        existing.amount = row.amount;
        existing.objectOfExpenditure = row.description;
        existing.fundSource = row.fundSource;
        totalAmount += row.amount;
        results.push({ rowNo: row.rowNo, status: "Updated", remarks: `Updated ${existing.referenceNo}` });
        continue;
      }
      if (existing || settings.importType === "update") {
        results.push({
          rowNo: row.rowNo,
          status: "Skipped",
          remarks: existing ? `Already exists as ${existing.referenceNo}` : "No existing record to update",
        });
        continue;
      }
      const referenceNo = nextSequence("APP", settings.fiscalYear, db.appropriations.map((a) => a.referenceNo));
      const record: Appropriation = {
        id: referenceNo.toLowerCase(),
        referenceNo,
        fiscalYear: settings.fiscalYear,
        title: row.description,
        type: row.appropriationType === "Supplemental" ? "Supplemental" : "GAA",
        category: "Permanent",
        orgCode: row.orgCode,
        office: row.office,
        uacsCode: row.uacsObjectCode,
        objectOfExpenditure: row.description,
        papCode: row.papCode,
        program: row.program,
        allotmentClass: row.allotmentClass as AllotmentClassCode,
        fundSource: row.fundSource,
        amount: row.amount,
        allotted: 0,
        released: 0,
        level: "Agency",
        gaaReference: `GAA FY ${settings.fiscalYear}`,
        gaaPart: "",
        effectivityDate: `${settings.fiscalYear}-01-01`,
        expiryDate: `${settings.fiscalYear}-12-31`,
        remarks: row.remarks,
        documents: [],
        status: "Unreleased",
        createdAt: new Date().toISOString(),
      };
      db.appropriations.push(record);
      totalAmount += row.amount;
      results.push({
        rowNo: row.rowNo,
        status: row.warnings.length ? "With Warning" : "Imported",
        remarks: row.warnings.join("; "),
      });
    }

    batch.status = "Imported";
    batch.importedAt = new Date().toISOString();
    const count = (...s: GaaImportRowResult["status"][]) => results.filter((r) => s.includes(r.status)).length;
    const response: ImportGaaResponse = {
      batch: { ...batch },
      importedAt: batch.importedAt,
      importedBy: getMockSessionUserName(),
      total: rows.length,
      importedCount: count("Imported", "Updated", "With Warning"),
      failedCount: count("Failed"),
      warningCount: count("With Warning"),
      skippedCount: count("Skipped"),
      totalAmount,
      results,
    };
    db.gaaResults[batch.id] = response;
    return response;
  }),

  route("DELETE", "/gaa/uploads/:id", ({ params }) => {
    const batch = findBatch(params.id);
    if (batch.status === "Imported") throw new MockHttpError(409, "Imported files cannot be deleted.");
    db.gaaBatches = db.gaaBatches.filter((b) => b.id !== params.id);
    delete db.gaaRows[params.id];
    delete db.gaaColumns[params.id];
    return { message: "Upload deleted." };
  }),
];
