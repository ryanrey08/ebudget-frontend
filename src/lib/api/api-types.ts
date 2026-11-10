/**
 * Transport-level types shared by the API client, the mock API and the
 * service layer. Domain types live in src/features/<feature>/types.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue = string | number | boolean | null | undefined;
/** Query string parameters; arrays are sent as repeated keys (`a=1&a=2`). */
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export type ResponseType = "json" | "blob" | "text";

export interface ApiRequestConfig {
  method?: HttpMethod;
  /** Path relative to the API base URL (see src/lib/api/endpoints.ts). */
  url: string;
  params?: QueryParams | object;
  /** JSON-serialisable body, or FormData for file uploads. */
  body?: unknown;
  headers?: Record<string, string>;
  responseType?: ResponseType;
  /** Overrides the configured timeout for this request. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Do not attach the bearer token (e.g. for the login request). */
  skipAuth?: boolean;
  /** Return the response body as-is instead of unwrapping the envelope. */
  rawResponse?: boolean;
}

/**
 * Envelope a backend may wrap responses in. The client unwraps it (see
 * api-response.ts), so services and components only ever see `data`.
 */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
  errors?: Record<string, string | string[]>;
}

/** Laravel-style pagination metadata. */
export interface PaginationMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

/** A downloaded file. */
export interface DownloadedFile {
  blob: Blob;
  fileName: string;
  contentType: string;
}
