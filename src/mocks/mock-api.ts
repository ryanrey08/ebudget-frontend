import type { ApiConfig } from "@/config/api.config";
import type { ApiTransportResult } from "@/lib/api/api-client";
import type { ApiRequestConfig } from "@/lib/api/api-types";
import { mockRoutes } from "./handlers";
import { MockHttpError, matchPath, type QueryValue } from "./services/http";
import { persistMockDb } from "./services/persistence";

/**
 * In-browser mock API. It answers the same paths as the future backend
 * (src/lib/api/endpoints.ts), wraps results in the same envelope
 * (`{ success, data }`) and returns errors as HTTP statuses with
 * `{ success: false, message, errors }`, so the API client handles both modes
 * through one code path.
 *
 * Handlers read and write the in-memory database in ./services/db.ts, so
 * creates, updates and deletes are reflected everywhere for the rest of the
 * session (and across reloads when NEXT_PUBLIC_MOCK_API_PERSIST=true).
 */

const delay = (ms: number) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

interface ForcedFailure {
  status: number;
  message?: string;
  /** Only fail requests whose path contains this text. */
  match?: string;
}

const forcedFailures: ForcedFailure[] = [];

/**
 * Developer controls for testing error states in mock mode. In the browser
 * console (development builds) use `__EBUDGET_MOCK__.failNext(500)` or
 * `__EBUDGET_MOCK__.failNext(0)` for a network error.
 */
export const mockControls = {
  /** Make the next matching request fail with this status (0 = network error). */
  failNext(status: number, options: { message?: string; match?: string } = {}) {
    forcedFailures.push({ status, ...options });
  },
  clearFailures() {
    forcedFailures.length = 0;
  },
};

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __EBUDGET_MOCK__?: typeof mockControls }).__EBUDGET_MOCK__ = mockControls;
}

function takeForcedFailure(path: string) {
  const index = forcedFailures.findIndex((f) => !f.match || path.includes(f.match));
  return index === -1 ? null : forcedFailures.splice(index, 1)[0];
}

function errorResult(status: number, message: string, fieldErrors?: Record<string, string>): ApiTransportResult {
  return { status, body: { success: false, message, ...(fieldErrors ? { errors: fieldErrors } : {}) } };
}

function toQuery(params: ApiRequestConfig["params"]): Record<string, QueryValue> {
  const out: Record<string, QueryValue> = {};
  for (const [key, value] of Object.entries((params ?? {}) as Record<string, unknown>)) {
    out[key] = Array.isArray(value) ? value.join(",") : (value as QueryValue);
  }
  return out;
}

export async function handleMockRequest(config: ApiRequestConfig, settings: Pick<ApiConfig, "mockDelayMs" | "mockFailureRate" | "mockPersist">): Promise<ApiTransportResult> {
  const method = config.method ?? "GET";
  const [path, inlineQuery] = config.url.split("?");
  const query = { ...Object.fromEntries(new URLSearchParams(inlineQuery ?? "")), ...toQuery(config.params) };

  await delay(config.timeoutMs !== undefined ? Math.min(settings.mockDelayMs, config.timeoutMs) : settings.mockDelayMs);

  const forced = takeForcedFailure(path);
  if (forced) {
    if (forced.status === 0) throw new (await import("@/lib/api/api-error")).ApiRequestError("FETCH_ERROR");
    return errorResult(forced.status, forced.message ?? "Simulated mock API failure.");
  }
  if (settings.mockFailureRate > 0 && Math.random() < settings.mockFailureRate) {
    return errorResult(503, "Simulated mock API outage. Please try again.");
  }

  for (const route of mockRoutes) {
    if (route.method !== method) continue;
    const routeParams = matchPath(route.path, path);
    if (!routeParams) continue;
    try {
      const data = await route.handler({ params: routeParams, query, body: config.body as never });
      if (method !== "GET" && settings.mockPersist) persistMockDb();
      if (typeof Blob !== "undefined" && data instanceof Blob) return { status: 200, body: data };
      // Clone so cached data is never the same object the mock DB mutates.
      return { status: 200, body: { success: true, data: data === undefined ? null : structuredClone(data) } };
    } catch (error) {
      if (error instanceof MockHttpError) return errorResult(error.status, error.message, error.fieldErrors);
      console.error("[mock api]", error);
      return errorResult(500, "Unexpected error in mock API.");
    }
  }

  return errorResult(404, `No mock handler for ${method} ${path}`);
}
