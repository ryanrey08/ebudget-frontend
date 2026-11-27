/**
 * Shared shapes of the eBudget backend (Laravel 12, backend-api `main`).
 * Feature contracts live next to their features (e.g.
 * src/features/master-data/types.ts) and mirror the backend's API Resources
 * field for field. Amounts are always pesos as 2-decimal strings
 * ("50000000.00"); ids are integers or ULID strings as the backend sends them.
 */

/** ISO 8601 timestamp, e.g. 2026-11-20T08:00:00+00:00 */
export type IsoDateTime = string;
/** Calendar date, YYYY-MM-DD */
export type IsoDate = string;
/** Pesos with 2 decimals, as a string: "50000000.00" */
export type PesoString = string;
/** 26-character ULID */
export type Ulid = string;

/** Query parameters every paginated backend list accepts. */
export interface BackendPageQuery {
  /** 1-based page (Laravel paginator). */
  page?: number;
  /** 1 to 100 (config api.pagination.max_per_page), default 15. */
  per_page?: number;
}

/** `is_active` filter: 1 = only active, 0 = only inactive. */
export type ActiveFilter = 0 | 1;

/** Small `{ id, name }` reference used for users in many resources. */
export interface UserRef {
  id: Ulid;
  name: string;
}

/** Converts a backend peso string to a number for display and charts. */
export const pesos = (value: PesoString | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Formats a number as the backend's peso string ("1234.50"). */
export const toPesoString = (value: number | string): PesoString => {
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n.toFixed(2) : String(value);
};
