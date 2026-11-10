import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, buildUrl, setApiSettings } from "@/lib/api/api-client";
import { clearAuthToken, onAuthEvent, setAuthToken } from "@/lib/api/auth-token";
import { toPlainApiError } from "@/lib/api/api-error";

const BASE = "https://backend.test/api";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("api client in real mode", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setApiSettings({ mode: "real", baseUrl: BASE, timeoutMs: 1000 });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    setApiSettings(null);
    clearAuthToken();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("builds URLs from the configured base URL and skips empty params", () => {
    expect(buildUrl(BASE, "/appropriations", { page: 2, search: "", status: undefined, ids: [1, 2] })).toBe(
      `${BASE}/appropriations?page=2&ids=1&ids=2`,
    );
  });

  it("sends GET with query params and normalizes the envelope", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [{ id: 1 }], meta: { current_page: 1, per_page: 10, total: 1 } }));
    const result = await apiClient.get("/appropriations", { fiscalYear: 2026, page: 1 });
    expect(result).toEqual({ items: [{ id: 1 }], total: 1, page: 1, pageSize: 10 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/appropriations?fiscalYear=2026&page=1`);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(init.headers.get("Accept")).toBe("application/json");
  });

  it.each(["post", "put", "patch"] as const)("sends %s with a JSON body", async (method) => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "x" }));
    await apiClient[method]("/obligations/x", { amount: 5 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe(method.toUpperCase());
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ amount: 5 }));
  });

  it("sends DELETE and handles 204 No Content", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiClient.delete("/allotments/1")).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("uploads FormData without forcing a Content-Type", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "doc-1" }));
    const file = new File(["hello"], "gaa.csv", { type: "text/csv" });
    await apiClient.upload("/gaa/uploads", { file, fiscalYear: 2026 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("fiscalYear")).toBe("2026");
    expect(((init.body as FormData).get("file") as File).name).toBe("gaa.csv");
    expect(init.headers.get("Content-Type")).toBeNull();
  });

  it("downloads files with the server's file name", async () => {
    fetchMock.mockResolvedValue(new Response("a,b", { status: 200, headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="bfars-2.csv"' } }));
    const file = await apiClient.download("/reports/history/1/download", { fileName: "fallback.csv" });
    expect(file.fileName).toBe("bfars-2.csv");
    expect(await file.blob.text()).toBe("a,b");
  });

  it("attaches the bearer token when one is set, but not with skipAuth", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})));
    setAuthToken("test-token");
    await apiClient.get("/auth/me");
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer test-token");
    await apiClient.post("/auth/login", {}, { skipAuth: true });
    expect(fetchMock.mock.calls[1][1].headers.get("Authorization")).toBeNull();
  });

  it("clears the token and emits an event on 401", async () => {
    setAuthToken("expired");
    const events: string[] = [];
    const off = onAuthEvent((e) => events.push(e));
    fetchMock.mockResolvedValue(jsonResponse({ message: "Unauthenticated." }, 401));
    await expect(apiClient.get("/dashboard/overview")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED", message: "Unauthenticated." });
    expect(events).toContain("unauthorized");
    off();
  });

  it("emits a forbidden event on 403", async () => {
    const events: string[] = [];
    const off = onAuthEvent((e) => events.push(e));
    fetchMock.mockResolvedValue(jsonResponse({ message: "This action is unauthorized." }, 403));
    await expect(apiClient.post("/allotments/1/workflow", { action: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(events).toEqual(["forbidden"]);
    off();
  });

  it("returns 422 field errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "Invalid.", errors: { amount: ["Amount exceeds the balance."] } }, 422));
    const error = await apiClient.post("/obligations", {}).catch(toPlainApiError);
    expect(error).toMatchObject({ status: 422, fieldErrors: { amount: "Amount exceeds the balance." } });
  });

  it("reports a network error and never falls back to mock data", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await apiClient.get("/appropriations").catch(toPlainApiError);
    expect(error).toMatchObject({ status: "FETCH_ERROR", code: "NETWORK_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out slow requests", async () => {
    setApiSettings({ mode: "real", baseUrl: BASE, timeoutMs: 1000 });
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
    );
    const error = await apiClient.get("/bfars/bfars-2/saaodb", undefined, { timeoutMs: 20 }).catch(toPlainApiError);
    expect(error).toMatchObject({ status: "TIMEOUT_ERROR", code: "TIMEOUT" });
  });

  it("rejects invalid JSON with a parsing error", async () => {
    fetchMock.mockResolvedValue(new Response("{not json", { status: 200, headers: { "content-type": "application/json" } }));
    const error = await apiClient.get("/dashboard/overview").catch(toPlainApiError);
    expect(error).toMatchObject({ status: "PARSING_ERROR", code: "INVALID_RESPONSE" });
  });

  it("uses default messages for HTML error pages from a proxy", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    const error = await apiClient.get("/dashboard/overview").catch(toPlainApiError);
    expect(error).toMatchObject({ status: 502, message: "The eBudget server is unavailable. Please try again later." });
  });
});
