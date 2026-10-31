import type { GaaIssueCount, GaaRow, GaaSourceColumn, GaaValidationSummary } from "@/features/appropriations/types";
import { ALLOTMENT_CLASS_CODES } from "@/lib/constants/allotment-classes";
import { GAA_TEMPLATE_HEADERS } from "../data/gaa";

/**
 * Format-level checks only (required values, numbers, known allotment classes)
 * plus a duplicate-row warning. Business rules belong to the backend and are
 * intentionally not reproduced here.
 */
export function validateGaaRows(rows: GaaRow[], fiscalYear: number): GaaRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!/^\d{8}$/.test(row.uacsObjectCode)) errors.push("Invalid UACS Code");
    if (!row.fundSource.trim()) errors.push("Fund Source is required");
    if (!(ALLOTMENT_CLASS_CODES as readonly string[]).includes(row.allotmentClass)) errors.push("Invalid Allotment Class");
    if (!row.description.trim()) errors.push("Description is required");
    if (!(row.amount > 0)) errors.push("Amount must be greater than zero");
    if (row.fiscalYear && row.fiscalYear !== fiscalYear) errors.push(`Fiscal year must be ${fiscalYear}`);

    const key = [row.orgCode, row.uacsObjectCode, row.description.toLowerCase()].join("|");
    if (seen.has(key)) warnings.push("Duplicate record");
    seen.add(key);
    return { ...row, errors, warnings };
  });
}

function topIssues(messages: string[]): GaaIssueCount[] {
  const counts = new Map<string, number>();
  messages.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1));
  return [...counts.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function summarizeGaaRows(rows: GaaRow[]): GaaValidationSummary {
  const errorRows = rows.filter((r) => r.errors.length);
  const warningRows = rows.filter((r) => !r.errors.length && r.warnings.length);
  return {
    total: rows.length,
    valid: rows.length - errorRows.length - warningRows.length,
    errors: errorRows.length,
    warnings: warningRows.length,
    duplicates: rows.filter((r) => r.warnings.includes("Duplicate record")).length,
    topErrors: topIssues(rows.flatMap((r) => r.errors)),
    topWarnings: topIssues(rows.flatMap((r) => r.warnings)),
  };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

/** Parses a CSV that follows the GAA upload template column order. */
export function parseGaaCsv(text: string): { columns: GaaSourceColumn[]; rows: GaaRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headerIndex = lines.findIndex((l) => l.toLowerCase().startsWith("fiscal year"));
  if (headerIndex === -1) {
    throw new Error(`Header row not found. Expected columns: ${GAA_TEMPLATE_HEADERS.join(", ")}`);
  }
  const headers = splitCsvLine(lines[headerIndex]);
  const data = lines.slice(headerIndex + 1).map(splitCsvLine);
  const columns = headers.map((header, i) => ({
    key: String.fromCharCode(65 + i),
    header,
    sample: data[0]?.[i] ?? "",
  }));
  const rows = data.map((c, i) => ({
    rowNo: i + 1,
    fiscalYear: Number(c[0]) || 0,
    orgCode: c[1] ?? "",
    office: c[2] ?? "",
    uacsObjectCode: c[3] ?? "",
    description: c[4] ?? "",
    amount: Number((c[5] ?? "").replace(/[₱,\s]/g, "")),
    fundSource: c[6] ?? "",
    allotmentClass: (c[7] ?? "").toUpperCase(),
    program: c[8] ?? "",
    papCode: c[9] ?? "",
    appropriationType: c[10] ?? "",
    remarks: c[11] ?? "",
    errors: [],
    warnings: [],
  }));
  return { columns, rows };
}
