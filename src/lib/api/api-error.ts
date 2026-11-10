import type { ApiError, ApiErrorCode } from "@/types/api";

const STATUS_MESSAGES: Record<number, string> = {
  400: "The request was invalid.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource was not found.",
  405: "This action is not supported by the server.",
  408: "The request timed out. Please try again.",
  409: "This record was changed or is in use. Refresh and try again.",
  413: "The uploaded file is too large.",
  419: "Your session has expired. Please sign in again.",
  422: "Some fields are invalid.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "The server encountered an error. Please try again later.",
  502: "The eBudget server is unavailable. Please try again later.",
  503: "The eBudget server is unavailable. Please try again later.",
  504: "The eBudget server did not respond in time. Please try again later.",
};

export function codeForStatus(status: ApiError["status"]): ApiErrorCode {
  if (status === "FETCH_ERROR") return "NETWORK_ERROR";
  if (status === "TIMEOUT_ERROR") return "TIMEOUT";
  if (status === "PARSING_ERROR") return "INVALID_RESPONSE";
  if (typeof status !== "number") return "UNKNOWN";
  if (status === 401 || status === 419) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422 || status === 400) return "VALIDATION";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN";
}

export function defaultMessage(status: ApiError["status"]): string {
  if (status === "FETCH_ERROR") return "Unable to reach the eBudget server. Check your connection or try again later.";
  if (status === "TIMEOUT_ERROR") return "The request timed out. Please try again.";
  if (status === "PARSING_ERROR") return "The server sent a response the app could not read.";
  if (typeof status === "number") return STATUS_MESSAGES[status] ?? `Request failed (${status}).`;
  return "Something went wrong. Please try again.";
}

/**
 * Error thrown by the API client. It carries the same fields as the plain
 * `ApiError` object used by RTK Query and the UI; use `toJSON()` (or
 * `toPlainApiError`) before putting it in Redux, which needs serialisable values.
 */
export class ApiRequestError extends Error implements ApiError {
  readonly status: ApiError["status"];
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: ApiError["status"], message?: string, fieldErrors?: Record<string, string>) {
    super(message || defaultMessage(status));
    this.name = "ApiRequestError";
    this.status = status;
    this.code = codeForStatus(status);
    this.fieldErrors = fieldErrors && Object.keys(fieldErrors).length ? fieldErrors : undefined;
  }

  toJSON(): ApiError {
    return { status: this.status, code: this.code, message: this.message, ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}) };
  }
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "status" in value && "message" in value;
}

/** Field errors arrive as `{ field: "msg" }` or Laravel's `{ field: ["msg", ...] }`. */
export function flattenFieldErrors(errors: unknown): Record<string, string> | undefined {
  if (!errors || typeof errors !== "object") return undefined;
  const entries = Object.entries(errors as Record<string, unknown>)
    .map(([k, v]) => [k, Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "")] as const)
    .filter(([, v]) => v);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * Builds an error from an HTTP error response body. Only the backend's
 * `message` and field `errors` are shown; stack traces, SQL and other
 * technical details (e.g. Laravel's `exception`/`trace`) are dropped.
 */
export function errorFromResponse(status: number, body: unknown): ApiRequestError {
  const data = (typeof body === "object" && body !== null ? body : {}) as { message?: unknown; error?: unknown; errors?: unknown };
  let message = typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "";
  // Hide server internals on 5xx responses; they are not meaningful to users.
  if (status >= 500 || message.length > 300) message = "";
  return new ApiRequestError(status, message || undefined, flattenFieldErrors(data.errors));
}

/** Converts anything thrown during a request into a serialisable ApiError. */
export function toPlainApiError(error: unknown): ApiError {
  if (error instanceof ApiRequestError) return error.toJSON();
  if (isApiError(error)) return { ...error, code: error.code ?? codeForStatus(error.status) };
  if (error instanceof DOMException && error.name === "AbortError") {
    return { status: "CUSTOM_ERROR", code: "ABORTED", message: "The request was cancelled." };
  }
  const message = error instanceof Error && error.message ? error.message : defaultMessage("CUSTOM_ERROR");
  return { status: "CUSTOM_ERROR", code: "UNKNOWN", message };
}
