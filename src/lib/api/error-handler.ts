import type { SerializedError } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { ApiError } from "@/types/api";
import { isApiError } from "./api-error";

export { isApiError, toPlainApiError } from "./api-error";

/** Human readable message for any error surfaced by an RTK Query hook or service. */
export function getErrorMessage(error: ApiError | SerializedError | FetchBaseQueryError | undefined | unknown): string {
  if (!error) return "";
  if (isApiError(error)) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
