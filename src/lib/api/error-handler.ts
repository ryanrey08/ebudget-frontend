import type { SerializedError } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { ApiError } from "@/types/api";

interface ErrorBody {
  message?: string;
  errors?: Record<string, string | string[]>;
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === "object" && value !== null;
}

function flattenFieldErrors(errors: ErrorBody["errors"]): Record<string, string> | undefined {
  if (!errors) return undefined;
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "The request was invalid.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource was not found.",
  422: "Some fields are invalid.",
  500: "The server encountered an error. Please try again later.",
};

/** Converts whatever fetchBaseQuery returned into the app-wide ApiError shape. */
export function normalizeFetchError(error: FetchBaseQueryError): ApiError {
  if (typeof error.status === "number") {
    const body = isErrorBody(error.data) ? error.data : {};
    return {
      status: error.status,
      message: body.message ?? STATUS_MESSAGES[error.status] ?? `Request failed (${error.status}).`,
      fieldErrors: flattenFieldErrors(body.errors),
    };
  }
  if (error.status === "FETCH_ERROR") {
    return { status: error.status, message: "Unable to reach the eBudget server. Check your connection." };
  }
  if (error.status === "TIMEOUT_ERROR") {
    return { status: error.status, message: "The request timed out. Please try again." };
  }
  return { status: error.status, message: "error" in error ? String(error.error) : "Unexpected error." };
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "status" in value && "message" in value;
}

/** Human readable message for any error surfaced by an RTK Query hook. */
export function getErrorMessage(error: ApiError | SerializedError | FetchBaseQueryError | undefined | unknown): string {
  if (!error) return "";
  if (isApiError(error)) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
