import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * The Next.js auth proxy, with the backend replaced by a fetch stub that
 * answers in the formats of the real backend (SystemAuthController and
 * ApiExceptionRenderer).
 */
const ORIGIN = "http://localhost:3000";
const BACKEND = "http://backend.test/api/v1";

const backendUser = {
  id: "01JABCDEFGHJKMNPQRSTVWXYZ0",
  name: "Ana Villanueva",
  email: "ana@mpc.edu.ph",
  is_active: true,
  system: { key: "ebudget", name: "eBudget" },
  roles: [{ id: "01JROLE0000000000000000000", key: "admin", name: "Admin" }],
  last_login_at: "2026-11-12T02:00:00+00:00",
  created_at: "2026-11-01T00:00:00+00:00",
  is_super_admin: false,
  permissions: ["users.view", "roles.view"],
};

const json = (body: unknown, status = 200, type = "application/json") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": type } });

function request(path: string, init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers({ origin: ORIGIN, "x-requested-with": "XMLHttpRequest", "content-type": "application/json", ...init.headers });
  if (init.cookie) headers.set("cookie", `${SESSION_COOKIE}=${init.cookie}`);
  return new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

describe("auth proxy (src/app/api/auth)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    vi.stubEnv("BACKEND_SYSTEM", "ebudget");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("logs in, keeps the token in an httpOnly cookie and never returns it", async () => {
    const expires = new Date(Date.now() + 12 * 3600_000).toISOString();
    fetchMock.mockResolvedValue(json({ token_type: "Bearer", access_token: "1|secret-token", expires_at: expires, user: backendUser }));

    const res = await login(request("/api/auth/login", { body: { email: "ana@mpc.edu.ph", password: "pw", remember: true } }));
    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BACKEND}/ebudget/auth/login`);
    expect(JSON.parse(init.body)).toEqual({ email: "ana@mpc.edu.ph", password: "pw", device_name: "ebudget-web" });

    const text = await res.text();
    expect(text).not.toContain("secret-token");
    expect(JSON.parse(text)).toEqual({ user: backendUser, expiresAt: new Date(expires).toISOString() });

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=1%7Csecret-token`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toMatch(/Max-Age=\d+/);
  });

  it("uses a browser-session cookie without 'remember me'", async () => {
    fetchMock.mockResolvedValue(json({ token_type: "Bearer", access_token: "t", expires_at: new Date(Date.now() + 3600_000).toISOString(), user: backendUser }));
    const res = await login(request("/api/auth/login", { body: { email: "a@b.co", password: "pw", remember: false } }));
    expect(res.headers.get("set-cookie")).not.toMatch(/Max-Age/);
  });

  it("passes invalid-credential (422) and throttling (429) errors through", async () => {
    fetchMock.mockResolvedValue(
      json({ status: 422, code: "validation_failed", detail: "The given data was invalid.", errors: { email: ["These credentials do not match our records."] } }, 422, "application/problem+json"),
    );
    const res = await login(request("/api/auth/login", { body: { email: "a@b.co", password: "bad" } }));
    expect(res.status).toBe(422);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect((await res.json()).errors.email[0]).toBe("These credentials do not match our records.");

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 429, code: "too_many_requests", detail: "Too many requests. Please retry later." }), {
        status: 429,
        headers: { "content-type": "application/problem+json", "retry-after": "42" },
      }),
    );
    const throttled = await login(request("/api/auth/login", { body: { email: "a@b.co", password: "bad" } }));
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBe("42");
  });

  it("answers 503 when the backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await login(request("/api/auth/login", { body: { email: "a@b.co", password: "pw" } }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("backend_unavailable");
  });

  it("rejects cross-site login and logout requests", async () => {
    const res = await login(request("/api/auth/login", { body: {}, headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
    const noHeader = await logout(request("/api/auth/logout", { cookie: "t", headers: { "x-requested-with": "" } }));
    expect(noHeader.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the current user with the bearer token from the cookie", async () => {
    fetchMock.mockResolvedValue(json({ data: backendUser }));
    const res = await me(request("/api/auth/me", { method: "GET", cookie: "1|tok" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: backendUser });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BACKEND}/ebudget/auth/me`);
    expect(init.headers.get("Authorization")).toBe("Bearer 1|tok");
  });

  it("clears the cookie when the session is invalid or expired", async () => {
    fetchMock.mockResolvedValue(json({ status: 401, code: "unauthenticated", detail: "Authentication is required." }, 401, "application/problem+json"));
    const res = await me(request("/api/auth/me", { method: "GET", cookie: "expired" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);

    const anonymous = await me(request("/api/auth/me", { method: "GET" }));
    expect(anonymous.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no backend call without a cookie
  });

  it("revokes the token on logout and always clears the cookie", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await logout(request("/api/auth/logout", { cookie: "1|tok" }));
    expect(res.status).toBe(204);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BACKEND}/ebudget/auth/logout`);
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer 1|tok");
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);

    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const offline = await logout(request("/api/auth/logout", { cookie: "1|tok" }));
    expect(offline.status).toBe(503);
    expect(offline.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });
});
