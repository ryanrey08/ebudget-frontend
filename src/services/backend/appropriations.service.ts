import { BACKEND } from "@/lib/api/endpoints";
import type { Paginated } from "@/types/api";
import type {
  AppropriationLine,
  AppropriationLineInput,
  AppropriationLineQuery,
  GaaImport,
  GaaImportInput,
  GaaValidationReport,
} from "@/features/appropriations/types/lines";
import { backend, compact } from "./http";

/** Backend appropriation lines and the GAA upload (validate → correct → queued import). */
export const appropriationLinesService = {
  /** `meta.total_amount` is the sum of every matching line across all pages. */
  list: (query: AppropriationLineQuery) => backend.get<Paginated<AppropriationLine>>(BACKEND.appropriations, compact(query)),
  get: (id: number) => backend.get<AppropriationLine>(BACKEND.appropriation(id)),
  create: (input: AppropriationLineInput) => backend.post<AppropriationLine>(BACKEND.appropriations, input),
  update: (id: number, input: AppropriationLineInput) => backend.patch<AppropriationLine>(BACKEND.appropriation(id), input),
  remove: (id: number) => backend.delete(BACKEND.appropriation(id)),

  /** Parses and checks a filled-in GAA template (.xlsx, ≤ 5 MB). Nothing is saved. */
  validateUpload: (file: File) => backend.upload<GaaValidationReport>(BACKEND.gaaValidate, { file }, { timeoutMs: 120_000 }),
  /** 202 with the queued import, or 422 with every line error keyed `lines.{i}.cells.{field}`. */
  submitImport: (input: GaaImportInput) => backend.post<GaaImport>(BACKEND.gaaImports, input, { timeoutMs: 120_000 }),
  getImport: (id: string) => backend.get<GaaImport>(BACKEND.gaaImport(id)),
};
