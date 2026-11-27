import { apiClient } from "@/lib/api/api-client";
import type { ApiRequestConfig, QueryParams } from "@/lib/api/api-types";

type Options = Omit<ApiRequestConfig, "method" | "url" | "body" | "requiresBackend">;

/**
 * The API client for the eBudget backend's own endpoints (src/lib/api/endpoints
 * `BACKEND`). Every request is marked `requiresBackend`, so in mock mode it
 * fails with a clear "needs the backend" error instead of reaching a demo
 * handler with a different contract.
 */
export const backend = {
  get: <T>(url: string, params?: QueryParams | object, options?: Omit<Options, "params">) =>
    apiClient.request<T>({ ...options, method: "GET", url, params, requiresBackend: true }),
  post: <T>(url: string, body?: unknown, options?: Options) =>
    apiClient.request<T>({ ...options, method: "POST", url, body, requiresBackend: true }),
  put: <T>(url: string, body?: unknown, options?: Options) =>
    apiClient.request<T>({ ...options, method: "PUT", url, body, requiresBackend: true }),
  patch: <T>(url: string, body?: unknown, options?: Options) =>
    apiClient.request<T>({ ...options, method: "PATCH", url, body, requiresBackend: true }),
  delete: <T = null>(url: string, options?: Options) =>
    apiClient.request<T>({ ...options, method: "DELETE", url, requiresBackend: true }),
  /** multipart/form-data POST (PHP parses multipart bodies only on POST). */
  upload: <T>(url: string, fields: Record<string, string | Blob | null | undefined>, options?: Options) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null) form.append(key, value);
    return apiClient.request<T>({ ...options, method: "POST", url, body: form, requiresBackend: true });
  },
  download: (url: string, fileName?: string) => apiClient.download(url, { fileName, requiresBackend: true }),
};

/** Drops undefined/empty values so list filters are only sent when set. */
export function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Partial<T>;
}
