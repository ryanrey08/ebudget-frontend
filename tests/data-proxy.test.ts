import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/v1/[...path]/route";
import { backendPathOf } from "@/lib/server/backend-proxy";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * The same-origin data proxy (/api/v1/* → {BACKEND_API_URL}/{system}/*), with
 * the backend replaced by a fetch stub.
 */
const ORIGIN = "http://localhost:3000";
const BACKEND = "http://10.15.0.14/api/v1";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const problemJson = (status: number, code: string, detail: string, headers: Record<string, string> = {}) =>
  json({ type: "about:blank", status, code, detail }, status, { "content-type": "application/problem+json", ...headers });

function request(
  path: string,
  init: { method?: string; body?: BodyInit; cookie?: string | null; headers?: Record<string, string> } = {},
) {
  const headers = new Headers({ origin: ORIGIN, host: "localhost:3000", "x-requested-with": "XMLHttpRequest", ...init.headers });
  const cookie = init.cookie === undefined ? "1|data-token" : init.cookie;
  if (cookie) headers.set("cookie", `${SESSION_COOKIE}=${cookie}`);
  return new NextRequest(`${ORIGIN}${path}`, { method: init.method ?? "GET", headers, body: init.body });
}

describe("data proxy (src/app/api/v1/[...path])", () => {
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

  it("maps /api/v1/<path>?query to the backend's /api/v1/{system}/<path>?query", async () => {
    fetchMock.mockResolvedValue(json({ data: [{ id: 1 }], meta: { total: 1 } }));
    const res = await GET(request("/api/v1/appropriations?fiscalYear=2026&ids=1&ids=2"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: [{ id: 1 }], meta: { total: 1 } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BACKEND}/ebudget/appropriations?fiscalYear=2026&ids=1&ids=2`);
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("manual");
    expect(init.body).toBeUndefined();
  });

  it("attaches the bearer token from the session cookie, never the browser's own credentials", async () => {
    fetchMock.mockResolvedValue(json({ data: {} }));
    await GET(
      request("/api/v1/dashboard/overview", {
        headers: { authorization: "Bearer forged", accept: "application/json", "accept-language": "en-PH" },
      }),
    );
    const headers: Headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.get("Authorization")).toBe("Bearer 1|data-token");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Accept-Language")).toBe("en-PH");
    expect(headers.get("Cookie")).toBeNull();
    expect(headers.get("X-Requested-With")).toBeNull();
    expect(headers.get("Origin")).toBeNull();
  });

  it("forwards X-Forwarded-For and a well-formed X-Request-Id like the auth proxy", async () => {
    fetchMock.mockResolvedValue(json({ data: {} }));
    await GET(request("/api/v1/dashboard/overview", { headers: { "x-forwarded-for": "203.0.113.7", "x-request-id": "req-123_abc.9" } }));
    let headers: Headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.get("X-Forwarded-For")).toBe("203.0.113.7");
    expect(headers.get("X-Request-Id")).toBe("req-123_abc.9");

    await GET(request("/api/v1/dashboard/overview", { headers: { "x-request-id": "bad id;with=spaces" } }));
    headers = fetchMock.mock.calls[1][1].headers;
    expect(headers.get("X-Request-Id")).toBeNull();
    expect(headers.get("X-Forwarded-For")).toBeNull();
  });

  it.each([
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
  ] as const)("passes a %s JSON body through", async (method, handler) => {
    fetchMock.mockResolvedValue(json({ data: { id: "x" } }, method === "POST" ? 201 : 200));
    const res = await handler(
      request("/api/v1/obligations/x", { method, body: JSON.stringify({ amount: 5 }), headers: { "content-type": "application/json" } }),
    );
    expect(res.status).toBe(method === "POST" ? 201 : 200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BACKEND}/ebudget/obligations/x`);
    expect(init.method).toBe(method);
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(new TextDecoder().decode(init.body)).toBe(JSON.stringify({ amount: 5 }));
  });

  it("passes DELETE and 204 No Content through", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await DELETE(request("/api/v1/allotments/1", { method: "DELETE" }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("passes multipart uploads through byte for byte, boundary included", async () => {
    const form = new FormData();
    form.append("fiscalYear", "2026");
    form.append("file", new File([new Uint8Array([0, 1, 2, 250, 255]), "a,b\n"], "gaa.xlsx", { type: "application/octet-stream" }));
    const encoded = new Request("http://x", { method: "POST", body: form });
    const contentType = encoded.headers.get("content-type")!;
    const bytes = new Uint8Array(await encoded.arrayBuffer());

    fetchMock.mockResolvedValue(json({ data: { id: "upload-1" } }, 201));
    const res = await POST(request("/api/v1/gaa/uploads", { method: "POST", body: bytes, headers: { "content-type": contentType } }));
    expect(res.status).toBe(201);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BACKEND}/ebudget/gaa/uploads`);
    expect(init.headers.get("Content-Type")).toBe(contentType);
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(new Uint8Array(init.body)).toEqual(bytes);
  });

  it("streams file downloads back with their Content-Disposition", async () => {
    const file = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 255]);
    fetchMock.mockResolvedValue(
      new Response(file, {
        status: 200,
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": 'attachment; filename="bfars-2.xlsx"',
          "content-length": String(file.byteLength),
          "set-cookie": "backend_internal=1",
          server: "nginx",
        },
      }),
    );
    const res = await GET(request("/api/v1/reports/history/1/download", { headers: { accept: "*/*" } }));
    expect(fetchMock.mock.calls[0][1].headers.get("Accept")).toBe("*/*");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="bfars-2.xlsx"');
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("server")).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(file);
  });

  it("answers 401 without calling the backend when there is no session cookie", async () => {
    const res = await GET(request("/api/v1/appropriations", { cookie: null }));
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect((await res.json()).code).toBe("unauthenticated");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a backend 401 through and clears the session cookie", async () => {
    fetchMock.mockResolvedValue(problemJson(401, "unauthenticated", "Authentication is required."));
    const res = await GET(request("/api/v1/appropriations", { cookie: "expired" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toMatchObject({ code: "unauthenticated", detail: "Authentication is required." });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/Max-Age=0/);
  });

  it("passes backend problem-details errors through like forwardError", async () => {
    fetchMock.mockResolvedValue(
      json({ status: 422, code: "validation_failed", detail: "The given data was invalid.", errors: { amount: ["Too high."] } }, 422, {
        "content-type": "application/problem+json",
        "x-request-id": "req-1",
      }),
    );
    const invalid = await POST(request("/api/v1/obligations", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
    expect(invalid.status).toBe(422);
    expect(invalid.headers.get("content-type")).toBe("application/problem+json");
    expect(invalid.headers.get("x-request-id")).toBe("req-1");
    expect(invalid.headers.get("set-cookie")).toBeNull();
    expect((await invalid.json()).errors.amount).toEqual(["Too high."]);

    fetchMock.mockResolvedValue(problemJson(429, "too_many_requests", "Too many requests.", { "retry-after": "42" }));
    const throttled = await GET(request("/api/v1/appropriations"));
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBe("42");

    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 500, headers: { "content-type": "text/html" } }));
    const html = await GET(request("/api/v1/appropriations"));
    expect(html.status).toBe(502);
    expect((await html.json()).code).toBe("bad_gateway");
  });

  it("does not follow or expose backend redirects", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://10.15.0.14/login" } }));
    const res = await GET(request("/api/v1/appropriations"));
    expect(res.status).toBe(502);
    expect(res.headers.get("location")).toBeNull();
  });

  it("answers 503 when the backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await GET(request("/api/v1/appropriations"));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("backend_unavailable");
  });

  it.each([
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["Sec-Fetch-Site: cross-site", { "sec-fetch-site": "cross-site" }],
    ["no X-Requested-With", { "x-requested-with": "" }],
  ])("rejects cross-site requests (%s) without calling the backend", async (_label, headers) => {
    const get = await GET(request("/api/v1/appropriations", { headers }));
    expect(get.status).toBe(403);
    const post = await POST(request("/api/v1/obligations", { method: "POST", body: "{}", headers: { "content-type": "application/json", ...headers } }));
    expect(post.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the same host behind a reverse proxy (X-Forwarded-Host)", async () => {
    fetchMock.mockResolvedValue(json({ data: [] }));
    const res = await GET(
      request("/api/v1/appropriations", { headers: { origin: "https://ebudget.example.gov.ph", "x-forwarded-host": "ebudget.example.gov.ph" } }),
    );
    expect(res.status).toBe(200);
  });

  it("refuses the auth routes and path tricks", async () => {
    for (const path of ["/api/v1/auth/login", "/api/v1/AUTH/me", "/api/v1/a%2Fb", "/api/v1/x/%2E%2E%2Fauth"]) {
      const res = await GET(request(path));
      expect(res.status, path).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(backendPathOf("/api/v1/x/../y")).toBeNull();
    expect(backendPathOf("/api/v1/x//y")).toBeNull();
    expect(backendPathOf("/api/v1/allotment-classes/raoco/registry")).toBe("allotment-classes/raoco/registry");
    expect(backendPathOf("/api/v1/files/report%20q1.pdf")).toBe("files/report%20q1.pdf");
  });
});
