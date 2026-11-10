import type { Paginated } from "@/types/api";
import { ApiRequestError, flattenFieldErrors } from "./api-error";

/**
 * Response normalisation. Backends wrap their data differently, so the
 * client converts every response into the shapes the app uses:
 *
 *  - `{ success, message, data, meta }` envelope → `data`
 *    (`success: false` becomes an error even with HTTP 200)
 *  - Laravel resource collection `{ data: [], meta: { current_page, per_page, total } }`
 *    and paginator `{ data: [], current_page, per_page, total }` → `Paginated<T>`
 *  - `{ data: X }` (Laravel JsonResource) → `X`
 *  - anything else is returned unchanged
 *
 * If the real backend uses another format, adapt it here (or register a
 * custom normaliser with `setResponseNormalizer`) instead of in services.
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

const WRAPPER_KEYS = new Set(["data", "meta", "links", "message", "success", "status"]);

function toPaginated(items: unknown[], meta: Json): Paginated<unknown> {
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || fallback);
  return {
    items,
    total: num(meta.total, items.length),
    page: num(meta.current_page ?? meta.page, 1),
    pageSize: num(meta.per_page ?? meta.pageSize, items.length || 10),
  };
}

function hasPaginationMeta(meta: unknown): meta is Json {
  return isObject(meta) && ("current_page" in meta || "per_page" in meta) && "total" in meta;
}

export function defaultNormalizeResponse(body: unknown): unknown {
  if (!isObject(body)) return body;

  if (typeof body.success === "boolean") {
    if (!body.success) {
      throw new ApiRequestError(422, typeof body.message === "string" ? body.message : undefined, flattenFieldErrors(body.errors));
    }
    if (!("data" in body)) return body.message !== undefined ? { message: body.message } : null;
    const data = body.data;
    if (Array.isArray(data) && hasPaginationMeta(body.meta)) return toPaginated(data, body.meta);
    return defaultNormalizeResponse(data);
  }

  // Laravel paginator (LengthAwarePaginator::toArray()).
  if (Array.isArray(body.data) && hasPaginationMeta(body)) return toPaginated(body.data, body);

  // Laravel resource / collection wrapper.
  if ("data" in body && Object.keys(body).every((k) => WRAPPER_KEYS.has(k))) {
    if (Array.isArray(body.data) && hasPaginationMeta(body.meta)) return toPaginated(body.data, body.meta);
    return body.data;
  }

  return body;
}

let normalizer: (body: unknown) => unknown = defaultNormalizeResponse;

export function setResponseNormalizer(fn: (body: unknown) => unknown) {
  normalizer = fn;
}

export function normalizeResponse<T>(body: unknown): T {
  return normalizer(body) as T;
}
