/**
 * Server-only helpers for the Next.js auth proxy (src/app/api/auth/*).
 *
 * The backend (Laravel 12, see docs/AUTH_API_INTEGRATION.md) issues expiring
 * bearer tokens per system: POST /api/v1/{system}/auth/login returns
 * `{ token_type, access_token, expires_at, user }`. Its CORS allows no browser
 * origin by default and it uses no cookies, so the browser talks to these
 * same-origin route handlers instead:
 *
 *   browser ──(httpOnly cookie)──▶ /api/auth/* ──(Authorization: Bearer)──▶ backend
 *
 * The token is stored only in the httpOnly `ebudget_session` cookie and is
 * never put in a response body, Redux, localStorage or logs.
 *
 * Never import this file from client components.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

if (typeof window !== "undefined") {
  throw new Error("backend-auth.ts is server-only");
}

const SYSTEMS = ["ebudget", "engas", "sims"] as const;
type System = (typeof SYSTEMS)[number];

export interface BackendSettings {
  /** e.g. http://localhost:8080/api/v1 (no trailing slash) */
  baseUrl: string;
  system: System;
  timeoutMs: number;
}

/** Reads the server-only backend settings (never NEXT_PUBLIC_*). */
export function backendSettings(): BackendSettings {
  const baseUrl = (process.env.BACKEND_API_URL ?? "http://localhost:8080/api/v1").trim().replace(/\/+$/, "");
  const requested = (process.env.BACKEND_SYSTEM ?? "ebudget").trim().toLowerCase();
  const system = (SYSTEMS as readonly string[]).includes(requested) ? (requested as System) : "ebudget";
  const timeout = Number(process.env.BACKEND_TIMEOUT_MS);
  return { baseUrl, system, timeoutMs: Number.isFinite(timeout) && timeout >= 1_000 ? timeout : 15_000 };
}

/** Backend URL of a system route, e.g. systemUrl("auth/login"). */
export function systemUrl(path: string, settings = backendSettings()): string {
  return `${settings.baseUrl}/${settings.system}/${path.replace(/^\/+/, "")}`;
}

/** Problem-details error in the backend's format, for failures of the proxy itself. */
export function problem(status: number, code: string, detail: string, headers?: HeadersInit) {
  const titles: Record<number, string> = { 401: "Unauthorized", 403: "Forbidden", 415: "Unsupported Media Type", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout" };
  return NextResponse.json(
    { type: "about:blank", title: titles[status] ?? "Error", status, code, detail },
    { status, headers: { ...Object.fromEntries(new Headers(headers)), "Content-Type": "application/problem+json", "Cache-Control": "no-store" } },
  );
}

/**
 * CSRF protection for the cookie-authenticated proxy. The cookie is
 * SameSite=Lax; state-changing requests must also come from this origin
 * (Origin / Sec-Fetch-Site) and carry the X-Requested-With header the app's
 * API client always sends (a custom header forces a CORS preflight, which
 * these handlers never approve).
 */
/**
 * Whether the Origin header names the host the browser sent this request to.
 * Compared with the Host (or a reverse proxy's X-Forwarded-Host) header, not
 * with `request.nextUrl.origin`: when the server listens on 0.0.0.0 (Docker,
 * `next start -H 0.0.0.0`) or behind a proxy, nextUrl reports the bind
 * address (http://0.0.0.0:3000) rather than the address the browser used.
 */
function isSameHost(origin: string, request: NextRequest): boolean {
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // includes Origin: null
  }
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host") || request.nextUrl.host;
  return originHost.toLowerCase() === host.toLowerCase();
}

export function rejectCrossSite(request: NextRequest): NextResponse | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return problem(403, "forbidden", "Cross-site requests are not allowed.");
  const origin = request.headers.get("origin");
  if (origin && !isSameHost(origin, request)) return problem(403, "forbidden", "Cross-site requests are not allowed.");
  if (request.headers.get("x-requested-with") !== "XMLHttpRequest") {
    return problem(403, "forbidden", "Missing X-Requested-With header.");
  }
  return null;
}

export interface BackendResult {
  status: number;
  body: unknown;
  headers: Headers;
}

/**
 * Calls the backend. Network failures and timeouts become 503 / 504 problem
 * responses (thrown as `BackendUnavailable`) so the browser gets a clean error.
 */
export class BackendUnavailable extends Error {
  constructor(public readonly response: NextResponse) {
    super("Backend unavailable");
  }
}

export async function callBackend(
  request: NextRequest,
  path: string,
  init: { method: "GET" | "POST"; token?: string | null; body?: unknown },
): Promise<BackendResult> {
  const settings = backendSettings();
  const headers = new Headers({ Accept: "application/json" });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  const requestId = request.headers.get("x-request-id");
  if (requestId && /^[A-Za-z0-9._-]{1,64}$/.test(requestId)) headers.set("X-Request-Id", requestId);
  // Lets the backend rate-limit per browser, not per proxy. The backend only
  // trusts X-Forwarded-For from private networks (bootstrap/app.php).
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("X-Forwarded-For", forwardedFor);

  let response: Response;
  try {
    response = await fetch(systemUrl(path, settings), {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(settings.timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new BackendUnavailable(
      timedOut
        ? problem(504, "backend_timeout", "The eBudget server did not respond in time. Please try again later.")
        : problem(503, "backend_unavailable", "Unable to reach the eBudget server. Please try again later."),
    );
  }

  const text = response.status === 204 ? "" : await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null; // e.g. an HTML error page from a proxy in front of the API
    }
  }
  return { status: response.status, body, headers: response.headers };
}

/** Passes a backend error through unchanged (problem details), minus internals. */
export function forwardError(result: BackendResult): NextResponse {
  const headers = new Headers({ "Content-Type": "application/problem+json", "Cache-Control": "no-store" });
  for (const name of ["retry-after", "x-request-id"]) {
    const value = result.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (result.body === null) {
    return problem(result.status >= 500 ? 502 : result.status, "bad_gateway", "The eBudget server sent an unexpected response.", headers);
  }
  return NextResponse.json(result.body, { status: result.status, headers });
}

export const readSessionToken = (request: NextRequest) => request.cookies.get(SESSION_COOKIE)?.value ?? null;

const secureCookies = () => process.env.NODE_ENV === "production" && process.env.SESSION_COOKIE_INSECURE !== "true";

/**
 * Stores the backend token in the httpOnly session cookie. With `persistent`
 * the cookie lasts until the token expires; otherwise it is a browser-session
 * cookie (an expired token is answered with 401, which clears it).
 */
export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date, persistent: boolean) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    ...(persistent ? { maxAge } : {}),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({ name: SESSION_COOKIE, value: "", httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 0 });
}
