/**
 * Server-only same-origin proxy for the eBudget data API (real data mode).
 *
 *   browser ──(httpOnly cookie)──▶ /api/v1/<path> ──(Authorization: Bearer)──▶ {BACKEND_API_URL}/{system}/<path>
 *
 * The browser never calls the backend itself: the bearer token stays in the
 * httpOnly session cookie set by the auth proxy (src/app/api/auth), there is
 * no CORS to configure, no mixed content once the site is on HTTPS, and the
 * backend can stay on a private network (BACKEND_API_URL).
 *
 * The client's paths (src/lib/api/endpoints.ts) carry no system, so
 * `/api/v1/appropriations?page=2` is sent to
 * `{BACKEND_API_URL}/{BACKEND_SYSTEM}/appropriations?page=2`, the backend's
 * `/api/v1/{system}/...` layout. `/api/v1/auth/*` is refused: sign-in goes
 * through /api/auth/*, which keeps the access token out of response bodies.
 *
 * Never import this file from client components.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  backendSettings,
  clearSessionCookie,
  forwardError,
  problem,
  readBackendResult,
  readSessionToken,
  rejectCrossSite,
  setForwardingHeaders,
  systemUrl,
} from "./backend-auth";

if (typeof window !== "undefined") {
  throw new Error("backend-proxy.ts is server-only");
}

/** Same-origin path the browser sends data requests to (see api.config.ts). */
export const DATA_PROXY_PREFIX = "/api/v1";

/** Browser request headers passed on to the backend. Cookies and any browser Authorization are not. */
const REQUEST_HEADERS = ["accept", "accept-language", "content-type", "if-match", "if-none-match", "if-modified-since", "if-unmodified-since"];

/** Backend response headers passed back to the browser on success. */
const RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "content-language",
  "etag",
  "last-modified",
  "retry-after",
  "x-request-id",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
];

/**
 * The backend path below the system (e.g. "appropriations/12/workflow"), still
 * percent-encoded as the browser sent it, or null when the path must not be
 * forwarded: empty or dot segments, encoded slashes, or the auth routes.
 */
export function backendPathOf(pathname: string): string | null {
  if (!pathname.startsWith(`${DATA_PROXY_PREFIX}/`)) return null;
  const rest = pathname.slice(DATA_PROXY_PREFIX.length + 1);
  const segments = rest.split("/");
  const decoded: string[] = [];
  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (!value || value === "." || value === ".." || /[/\\]/.test(value)) return null;
    decoded.push(value);
  }
  if (decoded[0].toLowerCase() === "auth") return null;
  return rest;
}

const notFound = () => problem(404, "not_found", "The requested resource was not found.");

/**
 * Forwards one browser request to the backend and streams the answer back.
 * Errors are answered as problem details: the backend's own (passed through
 * like the auth proxy's `forwardError`), or 401 / 403 / 404 / 502 / 503 / 504
 * from the proxy itself. A backend 401 also clears the session cookie, so the
 * route guard and the client's session-expired flow take over.
 */
export async function proxyToBackend(request: NextRequest): Promise<NextResponse> {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const path = backendPathOf(request.nextUrl.pathname);
  if (path === null) return notFound();

  const token = readSessionToken(request);
  if (!token) return problem(401, "unauthenticated", "Authentication is required.");

  const settings = backendSettings();
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("accept")) headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  setForwardingHeaders(headers, request);

  const method = request.method.toUpperCase();
  // Buffered (not streamed) so the backend gets a Content-Length, which PHP
  // needs to parse multipart uploads reliably. Multipart bytes and boundary
  // are passed on unchanged.
  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 0) body = buffer;
  }

  // The timeout covers the backend's response headers only, so a long file
  // download is not cut off; a browser that goes away cancels the request.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, settings.timeoutMs);
  request.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(`${systemUrl(path, settings)}${request.nextUrl.search}`, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    return timedOut
      ? problem(504, "backend_timeout", "The eBudget server did not respond in time. Please try again later.")
      : problem(503, "backend_unavailable", "Unable to reach the eBudget server. Please try again later.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    const answer = forwardError(await readBackendResult(response));
    clearSessionCookie(answer);
    return answer;
  }
  if (response.status >= 400) {
    return forwardError(await readBackendResult(response));
  }
  if (response.status >= 300 && response.status !== 304) {
    // A redirect would point the browser at the backend's own (private) host.
    await response.body?.cancel();
    return problem(502, "bad_gateway", "The eBudget server sent an unexpected response.");
  }

  const out = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  const empty = response.status === 204 || response.status === 205 || response.status === 304 || method === "HEAD";
  if (empty) {
    await response.body?.cancel();
    return new NextResponse(null, { status: response.status, headers: out });
  }
  // Content-Length / Content-Encoding are dropped: fetch has already decoded
  // the body, so the original values would no longer match.
  return new NextResponse(response.body, { status: response.status, headers: out });
}
