/** Error thrown by mock handlers; mapped to an RTK Query error result. */
export class MockHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export interface MockRequest<TBody = unknown> {
  params: Record<string, string>;
  query: Record<string, QueryValue>;
  body: TBody;
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface MockRoute {
  method: HttpMethod;
  /** Path pattern relative to the API base URL, e.g. "/obligations/:id/status" */
  path: string;
  handler: (req: MockRequest<never>) => unknown | Promise<unknown>;
}

/** Helper that keeps handler bodies typed while storing them in one table. */
export function route<TBody = unknown>(
  method: HttpMethod,
  path: string,
  handler: (req: MockRequest<TBody>) => unknown | Promise<unknown>,
): MockRoute {
  return { method, path, handler: handler as MockRoute["handler"] };
}

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function str(value: QueryValue): string {
  return value == null ? "" : String(value);
}

export function num(value: QueryValue, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== "" && value != null ? n : fallback;
}

export function paginate<T>(items: T[], query: Record<string, QueryValue>) {
  const page = Math.max(1, num(query.page, 1));
  const pageSize = Math.min(100, Math.max(1, num(query.pageSize, 10)));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export function matchesSearch(search: string, ...fields: (string | number)[]) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return fields.some((f) => String(f).toLowerCase().includes(needle));
}

export const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);
