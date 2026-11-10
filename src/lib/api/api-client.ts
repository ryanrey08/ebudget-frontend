import { apiConfig, type ApiConfig } from "@/config/api.config";
import { ApiRequestError, errorFromResponse } from "./api-error";
import { normalizeResponse } from "./api-response";
import type { ApiRequestConfig, DownloadedFile, HttpMethod, QueryParams, QueryValue } from "./api-types";
import { clearAuthToken, emitAuthEvent, getAuthToken } from "./auth-token";

/**
 * The single HTTP client used by the whole application (RTK Query's
 * baseQuery and every service in src/services go through it).
 *
 * - mode "mock": the request is answered by the in-browser mock API
 *   (src/mocks/mock-api.ts), which uses the same paths, envelopes and errors.
 * - mode "real": the request is sent with fetch to `apiConfig.baseUrl`.
 *
 * In real mode a failed request is reported as an error. It never falls back
 * to mock data.
 */

/** Something that can answer a request: the mock API or fetch. */
export interface ApiTransportResult {
  status: number;
  /** Parsed body (JSON object, text or Blob). */
  body: unknown;
  headers?: Headers;
}
export type ApiTransport = (config: ApiRequestConfig, settings: ApiConfig) => Promise<ApiTransportResult>;

function appendParam(search: URLSearchParams, key: string, value: QueryValue) {
  if (value === undefined || value === null || value === "") return;
  search.append(key, String(value));
}

export function buildQueryString(params?: QueryParams | object): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as QueryParams)) {
    if (Array.isArray(value)) value.forEach((v) => appendParam(search, key, v));
    else appendParam(search, key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function buildUrl(baseUrl: string, path: string, params?: QueryParams | object): string {
  if (/^https?:\/\//i.test(path)) return `${path}${buildQueryString(params)}`;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}${buildQueryString(params)}`;
}

const isFormData = (v: unknown): v is FormData => typeof FormData !== "undefined" && v instanceof FormData;
const isBlob = (v: unknown): v is Blob => typeof Blob !== "undefined" && v instanceof Blob;

async function parseBody(response: Response, responseType: ApiRequestConfig["responseType"]): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return null;
  if (response.ok && responseType === "blob") return response.blob();
  const text = await response.text();
  if (response.ok && responseType === "text") return text;
  if (!text) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") || /^[\s]*[{[]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      if (response.ok) throw new ApiRequestError("PARSING_ERROR");
      return null;
    }
  }
  if (response.ok && responseType !== "json") return text;
  if (response.ok) throw new ApiRequestError("PARSING_ERROR");
  return null; // e.g. an HTML error page from a proxy: use the default message
}

/** Real backend transport based on fetch. */
export const fetchTransport: ApiTransport = async (config, settings) => {
  const method = config.method ?? "GET";
  const headers = new Headers({ Accept: config.responseType === "blob" ? "*/*" : "application/json" });
  headers.set("X-Requested-With", "XMLHttpRequest");

  let body: BodyInit | undefined;
  if (config.body !== undefined && config.body !== null && method !== "GET") {
    if (isFormData(config.body) || isBlob(config.body) || typeof config.body === "string") {
      body = config.body; // the browser sets the multipart boundary itself
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(config.body);
    }
  }

  const token = config.skipAuth ? null : getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  for (const [key, value] of Object.entries(config.headers ?? {})) headers.set(key, value);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs ?? settings.timeoutMs);
  const onAbort = () => controller.abort();
  config.signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(buildUrl(settings.baseUrl, config.url, config.params), {
      method,
      headers,
      body,
      credentials: settings.withCredentials ? "include" : "same-origin",
      signal: controller.signal,
    });
    return { status: response.status, body: await parseBody(response, config.responseType), headers: response.headers };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (timedOut) throw new ApiRequestError("TIMEOUT_ERROR");
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiRequestError("FETCH_ERROR");
  } finally {
    clearTimeout(timer);
    config.signal?.removeEventListener("abort", onAbort);
  }
};

/** Mock transport, loaded lazily so mock data stays out of the real-mode bundle. */
export const mockTransport: ApiTransport = async (config, settings) => {
  const { handleMockRequest } = await import("@/mocks/mock-api");
  return handleMockRequest(config, settings);
};

let transportOverride: ApiTransport | null = null;
/** Replaces the transport (used by tests). Pass null to restore the default. */
export function setApiTransport(transport: ApiTransport | null) {
  transportOverride = transport;
}

let settingsOverride: Partial<ApiConfig> | null = null;
/** Overrides configuration values at runtime (used by tests). */
export function setApiSettings(overrides: Partial<ApiConfig> | null) {
  settingsOverride = overrides;
}

export function getApiSettings(): ApiConfig {
  return settingsOverride ? { ...apiConfig, ...settingsOverride } : apiConfig;
}

function fileNameFrom(headers: Headers | undefined, fallback: string) {
  const disposition = headers?.get("content-disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] ? decodeURIComponent(match[1]) : match?.[2];
  return name || fallback;
}

async function send(config: ApiRequestConfig): Promise<ApiTransportResult> {
  const settings = getApiSettings();
  const transport = transportOverride ?? (settings.mode === "mock" ? mockTransport : fetchTransport);
  const result = await transport(config, settings);

  if (result.status >= 200 && result.status < 300) return result;

  const error = errorFromResponse(result.status, result.body);
  if (error.code === "UNAUTHORIZED" && !config.skipAuth) {
    clearAuthToken();
    emitAuthEvent("unauthorized");
  } else if (error.code === "FORBIDDEN") {
    emitAuthEvent("forbidden");
  }
  throw error;
}

/** Sends a request and returns the normalised response data. Throws ApiRequestError. */
async function request<T>(config: ApiRequestConfig): Promise<T> {
  const result = await send(config);
  if (config.rawResponse || config.responseType === "blob" || config.responseType === "text") return result.body as T;
  return normalizeResponse<T>(result.body);
}

type Options = Omit<ApiRequestConfig, "method" | "url" | "body">;

const withBody =
  (method: HttpMethod) =>
  <T>(url: string, body?: unknown, options?: Options) =>
    request<T>({ ...options, method, url, body });

export const apiClient = {
  request,
  get: <T>(url: string, params?: QueryParams | object, options?: Omit<Options, "params">) =>
    request<T>({ ...options, method: "GET", url, params }),
  post: withBody("POST"),
  put: withBody("PUT"),
  patch: withBody("PATCH"),
  delete: <T>(url: string, options?: Options) => request<T>({ ...options, method: "DELETE", url }),

  /** multipart/form-data upload. Plain objects are converted to FormData. */
  upload: <T>(url: string, data: FormData | Record<string, string | number | Blob | null | undefined>, options?: Options) => {
    let form: FormData;
    if (isFormData(data)) {
      form = data;
    } else {
      form = new FormData();
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        form.append(key, isBlob(value) ? value : String(value));
      }
    }
    return request<T>({ ...options, method: "POST", url, body: form });
  },

  /** Downloads a file (GET by default) and returns it with its file name. */
  download: async (url: string, options?: Omit<Options, "responseType"> & { method?: HttpMethod; body?: unknown; fileName?: string }) => {
    const { fileName = "download", method = "GET", body, ...rest } = options ?? {};
    const result = await send({ ...rest, method, url, body, responseType: "blob" });
    const blob = isBlob(result.body) ? result.body : new Blob([typeof result.body === "string" ? result.body : JSON.stringify(result.body)]);
    const file: DownloadedFile = { blob, fileName: fileNameFrom(result.headers, fileName), contentType: blob.type || "application/octet-stream" };
    return file;
  },
};

/** Saves a downloaded file in the browser. */
export function saveDownloadedFile(file: DownloadedFile) {
  const href = URL.createObjectURL(file.blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1_000);
}

export type ApiClient = typeof apiClient;
