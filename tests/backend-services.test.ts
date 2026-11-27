import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiSettings, resolveRequestSettings, setApiSettings } from "@/lib/api/api-client";
import { toPlainApiError } from "@/lib/api/api-error";
import { backendPath } from "@/lib/api/endpoints";
import { isDemoOnlyPath } from "@/config/api.config";
import { accessService, allotmentRecordsService, appropriationLinesService, masterDataService } from "@/services/backend";

/** Backend services against a fetch stub shaped like the real eBudget backend (backend-api main). */
const BASE = "/api/backend";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("backend services", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    setApiSettings({ mode: "real", baseUrl: BASE, timeoutMs: 1000, demoModules: true });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    setApiSettings(null);
    vi.unstubAllGlobals();
  });

  it("keeps meta.total_amount next to the pagination", async () => {
    fetchMock.mockResolvedValue(json({ data: [{ id: 1, amount: "5.00" }], links: {}, meta: { current_page: 1, per_page: 15, total: 1, last_page: 1, total_amount: "5.00" } }));
    const page = await appropriationLinesService.list({ fiscal_year_id: "01J", search: "", per_page: 15 });
    expect(page).toEqual({ items: [{ id: 1, amount: "5.00" }], total: 1, page: 1, pageSize: 15, meta: { total_amount: "5.00" } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/appropriations?fiscal_year_id=01J&per_page=15`);
  });

  it("keeps the backend's problem code on errors", async () => {
    fetchMock.mockResolvedValue(json({ status: 409, code: "allotment_release_open", detail: "Another tranche isn't finished." }, 409));
    const error = await allotmentRecordsService.addRelease("01A", { release_kind: "full", release_date: "2026-06-01" }).catch(toPlainApiError);
    expect(error).toMatchObject({ status: 409, code: "CONFLICT", problemCode: "allotment_release_open", message: "Another tranche isn't finished." });
  });

  it("sends fiscal-year transitions and multipart uploads", async () => {
    fetchMock.mockImplementation(async () => json({ data: { id: "01F", status: "closed" } }));
    await masterDataService.fiscalYears.transition("01F", "close");
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/master-data/fiscal-years/01F/close`);
    await appropriationLinesService.validateUpload(new File(["x"], "gaa.xlsx"));
    const init = fetchMock.mock.calls[1][1];
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/appropriations/import/validate`);
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("returns a new user's one-time password", async () => {
    fetchMock.mockResolvedValue(json({ data: { id: "01U", name: "Juan", email: "juan@x.ph", roles: [] }, temporary_password: "Tmp-123" }, 201));
    const created = await accessService.createUser({ name: "Juan", email: "juan@x.ph" });
    expect(created).toEqual({ user: { id: "01U", name: "Juan", email: "juan@x.ph", roles: [] }, temporaryPassword: "Tmp-123" });
  });

  it("refuses backend-only calls in mock mode instead of reaching a demo handler", async () => {
    setApiSettings({ mode: "mock" });
    const error = await appropriationLinesService.list({}).catch(toPlainApiError);
    expect(error).toMatchObject({ problemCode: "backend_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes only the modules without backend endpoints to the demo data", () => {
    for (const p of ["/dashboard/overview", "/obligations", "/obligations/x/workflow", "/bfars/bfars-2/saaodb", "/reports", "/reports/history", "/allotment-classes/raops/registry", "/allotments/registry", "/allotments/A1/registry", "/profile", "/notifications"]) {
      expect(isDemoOnlyPath(p), p).toBe(true);
    }
    for (const p of ["/appropriations", "/allotments", "/allotments/01A/releases", "/master-data/allotment-classes", "/reports/datasets", "/reports/shares", "/users", "/approval-requests/1"]) {
      expect(isDemoOnlyPath(p), p).toBe(false);
    }
    expect(resolveRequestSettings("/dashboard/overview", getApiSettings()).mode).toBe("mock");
    expect(resolveRequestSettings("/appropriations", getApiSettings()).mode).toBe("real");
  });

  it("turns absolute backend URLs into client paths", () => {
    expect(backendPath("http://localhost:8080/api/v1/ebudget/allotments/01A/attachments/01B")).toBe("/allotments/01A/attachments/01B");
    expect(backendPath("http://localhost:8080/api/v1/ebudget/system-administration/agency-profile/logo")).toBe("/system-administration/agency-profile/logo");
  });
});

describe("demo-contract services in real mode", () => {
  it("answers the obligation/registry demo calls from the demo API, not the backend", async () => {
    setApiSettings({ mode: "real", baseUrl: BASE, demoModules: true, mockDelayMs: 0 });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { appropriationsService } = await import("@/services/appropriations.service");
    await appropriationsService.getLookups().catch(() => undefined);
    expect(fetchMock).not.toHaveBeenCalled();
    setApiSettings(null);
    vi.unstubAllGlobals();
  });
});
