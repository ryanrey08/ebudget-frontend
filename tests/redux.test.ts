import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store";
import { authApi } from "@/features/auth/services/authApi";
import { appropriationsApi } from "@/features/appropriations/services/appropriationsApi";
import { setApiSettings } from "@/lib/api/api-client";
import { mockControls } from "@/mocks/mock-api";

describe("Redux / RTK Query integration", () => {
  afterEach(() => {
    setApiSettings(null);
    mockControls.clearFailures();
    vi.unstubAllGlobals();
  });

  it("loads data through services and tracks loading, success and error state", async () => {
    const store = makeStore();
    const pending = store.dispatch(appropriationsApi.endpoints.getAppropriations.initiate({ fiscalYear: 2026, page: 1, pageSize: 5 }));
    expect(appropriationsApi.endpoints.getAppropriations.select({ fiscalYear: 2026, page: 1, pageSize: 5 })(store.getState()).isLoading).toBe(true);
    const result = await pending;
    expect(result.isSuccess).toBe(true);
    expect(result.data?.items).toHaveLength(5);

    mockControls.failNext(500, { match: "/appropriations/summary" });
    const failed = await store.dispatch(appropriationsApi.endpoints.getAppropriationSummary.initiate({ fiscalYear: 2026 }));
    expect(failed.isError).toBe(true);
    expect(failed.error).toMatchObject({ status: 500, code: "SERVER_ERROR" });
    // The central listener raised a toast for the failed query.
    expect(store.getState().alerts.some((a) => a.title === "Could not load data")).toBe(true);
  });

  it("keeps the session when the backend is unreachable but signs out on 401", async () => {
    setApiSettings({ mode: "real", baseUrl: "https://backend.test/api" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const store = makeStore();
    await store.dispatch(authApi.endpoints.getCurrentUser.initiate());
    expect(store.getState().auth.status).toBe("checking");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Unauthenticated." }), { status: 401, headers: { "content-type": "application/json" } })));
    await store.dispatch(authApi.endpoints.getCurrentUser.initiate(undefined, { forceRefetch: true }));
    expect(store.getState().auth.status).toBe("unauthenticated");
  });
});
