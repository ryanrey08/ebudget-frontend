import type { BaseQueryFn, FetchArgs } from "@reduxjs/toolkit/query";
import type { ApiError } from "@/types/api";
import { apiClient } from "./api-client";
import { toPlainApiError } from "./api-error";
import type { HttpMethod } from "./api-types";

/**
 * RTK Query base query. It delegates to the shared API client, so RTK Query
 * endpoints, Redux thunks and services all use the same configuration,
 * mock/real switch, authentication and error handling.
 */
export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (args, { signal }) => {
  const { url, method, body, params, headers } = typeof args === "string" ? ({ url: args } as FetchArgs) : args;
  try {
    const data = await apiClient.request({
      url,
      method: (method?.toUpperCase() ?? "GET") as HttpMethod,
      body,
      params,
      headers: headers as Record<string, string> | undefined,
      signal,
    });
    return { data };
  } catch (error) {
    return { error: toPlainApiError(error) };
  }
};

/**
 * Runs a service call inside an RTK Query `queryFn`, converting thrown errors
 * into the serialisable ApiError that RTK Query and the UI expect.
 */
export async function fromService<T>(call: () => Promise<T>): Promise<{ data: T } | { error: ApiError }> {
  try {
    return { data: await call() };
  } catch (error) {
    return { error: toPlainApiError(error) };
  }
}
