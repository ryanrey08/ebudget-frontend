import { apiConfig } from "@/config/api.config";
import { registerMockDb } from "./persistence";
import type { Allotment } from "@/features/allotments/types";
import type {
  Appropriation,
  GaaRow,
  GaaSourceColumn,
  GaaUploadBatch,
  ImportGaaResponse,
} from "@/features/appropriations/types";
import type { Obligation } from "@/features/obligation-management/types";
import type { AppNotification } from "@/features/notifications/types";
import type { GeneratedReport } from "@/features/reports/types";
import { buildBudgetSeed, recomputeLinks } from "../data/budget";
import { MOCK_USERS, type MockUserRecord } from "../data/users";
import { GAA_SEED_BATCHES, GAA_TEMPLATE_COLUMNS, type RowSeed } from "../data/gaa";
import { NOTIFICATIONS_SEED } from "../data/notifications";
import { REPORT_HISTORY_SEED } from "../data/reports";
import { summarizeGaaRows, validateGaaRows } from "./gaa-validation";
import { getMockSessionUserId } from "./session";

/** Template-shaped columns with the first row's values as samples. */
export function templateColumns(first: RowSeed | undefined, fiscalYear: number): GaaSourceColumn[] {
  const values = first
    ? [String(fiscalYear), first.orgCode, first.office, first.uacsObjectCode, first.description, first.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 }), first.fundSource, first.allotmentClass, first.program, first.papCode, first.appropriationType, first.remarks || "-"]
    : [];
  return GAA_TEMPLATE_COLUMNS.map((c, i) => ({ ...c, sample: values[i] ?? "" }));
}

export function seedRows(rows: RowSeed[], fiscalYear: number): GaaRow[] {
  return rows.map((r, i) => ({ ...r, rowNo: i + 1, fiscalYear, errors: [], warnings: [] }));
}

const gaaSeed = GAA_SEED_BATCHES.map((b) => {
  const rows = validateGaaRows(seedRows(b.rows, b.fiscalYear), b.fiscalYear);
  const summary = summarizeGaaRows(rows);
  const batch: GaaUploadBatch = {
    id: b.id,
    fileName: b.fileName,
    fileSize: b.fileSize,
    fiscalYear: b.fiscalYear,
    uploadedAt: b.uploadedAt,
    uploadedBy: b.uploadedBy,
    rowCount: rows.length,
    errorCount: summary.errors,
    warningCount: summary.warnings,
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    status: b.imported ? "Imported" : summary.errors ? "With Errors" : "Validated",
    importedAt: b.imported ? "2026-01-05T08:30:00.000Z" : undefined,
  };
  const result: ImportGaaResponse | undefined = b.imported
    ? {
        batch,
        importedAt: batch.importedAt!,
        importedBy: b.uploadedBy,
        total: rows.length,
        importedCount: rows.length,
        failedCount: 0,
        warningCount: 0,
        skippedCount: 0,
        totalAmount: batch.totalAmount,
        results: rows.map((r) => ({ rowNo: r.rowNo, status: "Imported", remarks: "" })),
      }
    : undefined;
  return { batch, rows, columns: templateColumns(b.rows[0], b.fiscalYear), result };
});

/**
 * In-memory database for the mock API. It lives for the lifetime of the
 * browser tab, so records created in the UI persist until a full reload.
 */
const budgets = [buildBudgetSeed(2026, 1), buildBudgetSeed(2025, 0.92), buildBudgetSeed(2024, 0.85)];

export const db: {
  users: MockUserRecord[];
  appropriations: Appropriation[];
  allotments: Allotment[];
  obligations: Obligation[];
  gaaBatches: GaaUploadBatch[];
  gaaRows: Record<string, GaaRow[]>;
  gaaColumns: Record<string, GaaSourceColumn[]>;
  gaaResults: Record<string, ImportGaaResponse>;
  notifications: AppNotification[];
  reportHistory: GeneratedReport[];
  resetTokens: Map<string, string>;
} = {
  users: MOCK_USERS.map((u) => ({ ...u, user: { ...u.user } })),
  appropriations: budgets.flatMap((b) => b.appropriations),
  allotments: budgets.flatMap((b) => b.allotments),
  obligations: budgets.flatMap((b) => b.obligations),
  gaaBatches: gaaSeed.map((g) => g.batch),
  gaaRows: Object.fromEntries(gaaSeed.map((g) => [g.batch.id, g.rows])),
  gaaColumns: Object.fromEntries(gaaSeed.map((g) => [g.batch.id, g.columns])),
  gaaResults: Object.fromEntries(gaaSeed.filter((g) => g.result).map((g) => [g.batch.id, g.result!])),
  notifications: NOTIFICATIONS_SEED.map((n) => ({ ...n })),
  reportHistory: [...REPORT_HISTORY_SEED],
  resetTokens: new Map<string, string>(),
};

export function relinkBudget() {
  recomputeLinks({ appropriations: db.appropriations, allotments: db.allotments, obligations: db.obligations });
}

export function nextSequence(prefix: string, fy: number, existing: string[]) {
  const max = existing
    .filter((ref) => ref.startsWith(`${prefix}-${fy}-`))
    .map((ref) => Number(ref.split("-").pop()))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${fy}-${String(max + 1).padStart(3, "0")}`;
}

export function getMockSessionUserName() {
  const userId = getMockSessionUserId();
  const user = db.users.find((u) => u.user.id === userId)?.user;
  return user ? `${user.firstName} ${user.lastName}` : "Unknown user";
}

/** Tables saved when NEXT_PUBLIC_MOCK_API_PERSIST=true (see ./persistence.ts). */
const PERSISTED_TABLES = [
  "users",
  "appropriations",
  "allotments",
  "obligations",
  "gaaBatches",
  "gaaRows",
  "gaaColumns",
  "gaaResults",
  "notifications",
  "reportHistory",
] as const;

if (apiConfig.mockPersist) {
  const saved = registerMockDb(() => Object.fromEntries(PERSISTED_TABLES.map((k) => [k, db[k]])));
  if (saved) {
    for (const key of PERSISTED_TABLES) {
      if (key in saved) (db as Record<string, unknown>)[key] = saved[key];
    }
  }
}
