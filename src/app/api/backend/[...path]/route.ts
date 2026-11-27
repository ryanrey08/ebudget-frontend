import { NextResponse, type NextRequest } from "next/server";
import {
  backendSettings,
  clearSessionCookie,
  problem,
  readSessionToken,
  rejectCrossSite,
  systemUrl,
  toProxyLocation,
} from "@/lib/server/backend-auth";

/**
 * Same-origin data proxy: /api/backend/<path> → {BACKEND_API_URL}/{system}/<path>
 *
 * The browser cannot call the backend directly: its bearer token lives only
 * in the httpOnly `ebudget_session` cookie (set by /api/auth/login) and the
 * backend allows no browser origin in CORS. This handler adds
 * `Authorization: Bearer <token>` and passes the request and the response
 * through unchanged (JSON, multipart uploads and file downloads alike), so
 * the backend still authorises every call itself.
 *
 *   browser ──(cookie)──▶ /api/backend/master-data/fiscal-years ──(Bearer)──▶ /api/v1/ebudget/master-data/fiscal-years
 *
 * Authentication routes are not proxied here (they have their own handlers
 * in src/app/api/auth, which set and clear the cookie).
 */

export const dynamic = "force-dynamic";

const SEGMENT = /^[A-Za-z0-9._~-]+$/;
const PASSED_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "content-length",
  "cache-control",
  "x-request-id",
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
];

type Context = { params: Promise<{ path?: string[] }> };

async function proxy(request: NextRequest, context: Context): Promise<NextResponse> {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const segments = (await context.params).path ?? [];
  if (!segments.length || segments.some((s) => !SEGMENT.test(s) || s === "." || s === "..")) {
    return problem(404, "not_found", "Unknown API path.");
  }
  if (segments[0] === "auth") return problem(404, "not_found", "Use /api/auth for authentication.");

  const token = readSessionToken(request);
  if (!token) return problem(401, "unauthenticated", "Authentication is required.");

  const settings = backendSettings();
  const target = `${systemUrl(segments.join("/"), settings)}${request.nextUrl.search}`;

  const headers = new Headers({ Accept: request.headers.get("accept") || "application/json", Authorization: `Bearer ${token}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const requestId = request.headers.get("x-request-id");
  if (requestId && /^[A-Za-z0-9._-]{1,64}$/.test(requestId)) headers.set("X-Request-Id", requestId);
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("X-Forwarded-For", forwardedFor);

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength ? body : undefined,
      cache: "no-store",
      redirect: "manual",
      // Uploads (GAA workbooks, documents) can take longer than plain calls.
      signal: AbortSignal.timeout(Math.max(settings.timeoutMs, 60_000)),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return timedOut
      ? problem(504, "backend_timeout", "The eBudget server did not respond in time. Please try again later.")
      : problem(503, "backend_unavailable", "Unable to reach the eBudget server. Please try again later.");
  }

  const out = new Headers();
  for (const name of PASSED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("cache-control")) out.set("Cache-Control", "no-store");
  // A 201's Location names the backend; point it at this proxy instead.
  const location = upstream.headers.get("location");
  if (location) out.set("Location", toProxyLocation(location, settings.system));

  const isError = upstream.status >= 400;
  const upstreamType = upstream.headers.get("content-type") ?? "";
  let response: NextResponse;
  if (isError && !/json/i.test(upstreamType)) {
    // e.g. an HTML error page from a proxy in front of the API: never pass it on.
    await upstream.body?.cancel();
    response = problem(upstream.status >= 500 ? 502 : upstream.status, "bad_gateway", "The eBudget server sent an unexpected response.");
  } else {
    response = new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
  }
  // The token expired or was revoked: drop the cookie so the route guard signs the user out.
  if (upstream.status === 401) clearSessionCookie(response);
  return response;
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
