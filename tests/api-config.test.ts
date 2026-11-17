import { describe, expect, it } from "vitest";
import { DATA_PROXY_BASE_URL, DEFAULT_API_BASE_URL, resolveApiConfig } from "@/config/api.config";

describe("resolveApiConfig", () => {
  it("defaults to mock mode and the default base URL", () => {
    const config = resolveApiConfig({});
    expect(config.mode).toBe("mock");
    expect(config.baseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(config.warnings).toEqual([]);
  });

  it("reads NEXT_PUBLIC_API_MODE and strips trailing slashes from the base URL", () => {
    const config = resolveApiConfig({ mode: "real", baseUrl: "/ebudget/api/v1//" });
    expect(config.mode).toBe("real");
    expect(config.baseUrl).toBe("/ebudget/api/v1");
  });

  it("sends real-mode data requests to the same-origin data proxy by default", () => {
    const config = resolveApiConfig({ mode: "real" });
    expect(DEFAULT_API_BASE_URL).toBe(DATA_PROXY_BASE_URL);
    expect(config.baseUrl).toBe("/api/v1");
    expect(config.warnings).toEqual([]);
  });

  it.each(["https://api.example.gov.ph/api", "http://10.15.0.14/api/v1", "//backend.test/api", "/api/auth"])(
    "never lets the browser call the backend directly (%s)",
    (baseUrl) => {
      const config = resolveApiConfig({ mode: "real", baseUrl });
      expect(config.baseUrl).toBe(DATA_PROXY_BASE_URL);
      expect(config.warnings[0]).toMatch(/same-origin path/);
    },
  );

  it("accepts the mode case-insensitively", () => {
    expect(resolveApiConfig({ mode: " REAL " }).mode).toBe("real");
  });

  it("falls back to mock with a warning on an unknown mode", () => {
    const config = resolveApiConfig({ mode: "staging" });
    expect(config.mode).toBe("mock");
    expect(config.warnings[0]).toMatch(/not supported/);
  });

  it("keeps supporting the legacy NEXT_PUBLIC_USE_MOCK_API flag", () => {
    expect(resolveApiConfig({ legacyUseMock: "false" }).mode).toBe("real");
    expect(resolveApiConfig({ legacyUseMock: "true" }).mode).toBe("mock");
    // The new variable wins.
    expect(resolveApiConfig({ mode: "mock", legacyUseMock: "false" }).mode).toBe("mock");
  });

  it("rejects a base URL that is not a path", () => {
    const config = resolveApiConfig({ mode: "real", baseUrl: "ftp://x" });
    expect(config.baseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(config.warnings.length).toBe(1);
  });

  it("clamps numeric settings", () => {
    const config = resolveApiConfig({ timeoutMs: "5", mockDelayMs: "abc", mockFailureRate: "3" });
    expect(config.timeoutMs).toBe(1000);
    expect(config.mockDelayMs).toBe(150);
    expect(config.mockFailureRate).toBe(1);
  });
});
