import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/backend/[...path]/route";
import { PUT as changePassword } from "@/app/api/auth/password/route";
import { SESSION_COOKIE } from "@/lib/auth/session";

/** The same-origin data proxy and the password route, with the backend replaced by a fetch stub. */
const ORIGIN = "http://localhost:3000";
const BACKEND = "http://backend.test/api/v1";

function request(path: string, init: { method?: string; body?: BodyInit; cookie?: string | null; headers?: Record<string, string> } = {}) {
  const headers = new Headers({ origin: ORIGIN, "x-requested-with": "XMLHttpRequest", ...init.headers });
  if (init.cookie !== null) headers.set("cookie", `${SESSION_COOKIE}=${init.cookie ?? "1|token"}`);
  return new NextRequest(`${ORIGIN}${path}`, { method: init.method ?? "GET", headers, body: init.body });
}
const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });

describe("data proxy (src/app/api/backend)", () => {
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

  it("forwards GET with the bearer token and the query string", async () => {
    fetchMock.mockResolvedValue(json({ data: [], meta: { total: 0, total_amount: "0.00" } }));
    const res = await GET(request("/api/backend/appropriations?fiscal_year_id=01J&per_page=15"), ctx(["appropriations"]));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BACKEND}/ebudget/appropriations?fiscal_year_id=01J&per_page=15`);
    expect(init.headers.get("Authorization")).toBe("Bearer 1|token");
    expect(await res.json()).toEqual({ data: [], meta: { total: 0, total_amount: "0.00" } });
  });

  it("passes JSON bodies and rewrites a 201 Location to the proxy", async () => {
    fetchMock.mockResolvedValue(json({ data: { id: 5 } }, 201, { location: `${BACKEND}/ebudget/appropriations/5` }));
    const res = await POST(
      request("/api/backend/appropriations", { method: "POST", body: JSON.stringify({ amount: "1.00" }), headers: { "content-type": "application/json" } }),
      ctx(["appropriations"]),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("location")).toBe("/api/backend/appropriations/5");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(new TextDecoder().decode(init.body)).toBe('{"amount":"1.00"}');
  });

  it("answers 401 without a session and clears the cookie when the backend says 401", async () => {
    expect((await GET(request("/api/backend/users", { cookie: null }), ctx(["users"]))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(json({ status: 401, code: "unauthenticated", detail: "Unauthenticated." }, 401));
    const res = await GET(request("/api/backend/users"), ctx(["users"]));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`${SESSION_COOKIE}=;`));
  });

  it("refuses cross-site requests, unsafe paths and the auth routes", async () => {
    expect((await GET(request("/api/backend/users", { headers: { "sec-fetch-site": "cross-site" } }), ctx(["users"]))).status).toBe(403);
    expect((await GET(request("/api/backend/x"), ctx(["..", "etc"]))).status).toBe(404);
    expect((await GET(request("/api/backend/auth/me"), ctx(["auth", "me"]))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes problem details through and hides HTML error pages", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 409, code: "fiscal_year_not_open", detail: "closed" }, 409, { "content-type": "application/problem+json" }));
    const conflict = await POST(request("/api/backend/appropriations", { method: "POST", body: "{}" }), ctx(["appropriations"]));
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).code).toBe("fiscal_year_not_open");
    fetchMock.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    const html = await GET(request("/api/backend/users"), ctx(["users"]));
    expect(html.status).toBe(502);
    expect((await html.json()).code).toBe("bad_gateway");
  });

  it("answers 503 when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await GET(request("/api/backend/users"), ctx(["users"]));
    expect(res.status).toBe(503);
  });

  it("changes the password through PUT /api/auth/password", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const body = JSON.stringify({ current_password: "old", password: "New-Passw0rd!x", password_confirmation: "New-Passw0rd!x", extra: "dropped" });
    const ok = await changePassword(request("/api/auth/password", { method: "PUT", body, headers: { "content-type": "application/json" } }));
    expect(ok.status).toBe(204);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BACKEND}/ebudget/auth/password`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ current_password: "old", password: "New-Passw0rd!x", password_confirmation: "New-Passw0rd!x" });

    fetchMock.mockResolvedValueOnce(json({ status: 422, code: "validation_failed", errors: { current_password: ["The password is incorrect."] } }, 422));
    const bad = await changePassword(request("/api/auth/password", { method: "PUT", body, headers: { "content-type": "application/json" } }));
    expect(bad.status).toBe(422);
  });
});
