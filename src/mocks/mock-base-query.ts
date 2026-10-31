import type { FetchArgs } from "@reduxjs/toolkit/query";
import { env } from "@/config/env";
import type { ApiError } from "@/types/api";
import { mockRoutes } from "./handlers";
import { MockHttpError, matchPath, type HttpMethod, type QueryValue } from "./services/http";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves RTK Query requests against the in-memory mock API, mimicking
 * network latency and HTTP error responses.
 */
export async function mockBaseQuery(
  args: string | FetchArgs,
): Promise<{ data: unknown; error?: undefined } | { error: ApiError; data?: undefined }> {
  const { url, method = "GET", body, params } = typeof args === "string" ? { url: args } : args;
  const verb = method.toUpperCase() as HttpMethod;
  const path = url.split("?")[0];

  await delay(env.mockApiDelayMs);

  for (const route of mockRoutes) {
    if (route.method !== verb) continue;
    const routeParams = matchPath(route.path, path);
    if (!routeParams) continue;
    try {
      const data = await route.handler({
        params: routeParams,
        query: (params ?? {}) as Record<string, QueryValue>,
        body: body as never,
      });
      // Clone so cached data is never the same object the mock DB mutates.
      return { data: data === undefined ? null : structuredClone(data) };
    } catch (error) {
      if (error instanceof MockHttpError) {
        return { error: { status: error.status, message: error.message, fieldErrors: error.fieldErrors } };
      }
      console.error("[mock api]", error);
      return { error: { status: 500, message: "Unexpected error in mock API." } };
    }
  }

  return { error: { status: 404, message: `No mock handler for ${verb} ${path}` } };
}
