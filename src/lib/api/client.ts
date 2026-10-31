import { fetchBaseQuery, type BaseQueryFn, type FetchArgs } from "@reduxjs/toolkit/query";
import { env } from "@/config/env";
import type { ApiError } from "@/types/api";
import { normalizeFetchError } from "./error-handler";

/**
 * HTTP client for the real backend. Authentication relies on the httpOnly
 * session cookie set by the backend, hence `credentials: "include"`.
 */
const httpBaseQuery = fetchBaseQuery({
  baseUrl: env.apiBaseUrl,
  credentials: "include",
  timeout: 30_000,
  prepareHeaders: (headers) => {
    headers.set("Accept", "application/json");
    return headers;
  },
});

const realBaseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (args, api, extra) => {
  const result = await httpBaseQuery(args, api, extra);
  return result.error ? { error: normalizeFetchError(result.error), meta: result.meta } : { data: result.data };
};

/**
 * Base query used by RTK Query. When NEXT_PUBLIC_USE_MOCK_API is enabled the
 * request is answered by the in-browser mock API instead (loaded lazily so the
 * mock code is split out of the main bundle).
 */
export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (args, api, extra) => {
  if (env.useMockApi) {
    const { mockBaseQuery } = await import("@/mocks/mock-base-query");
    return mockBaseQuery(args);
  }
  return realBaseQuery(args, api, extra);
};
