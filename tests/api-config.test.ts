import { describe, expect, it } from "vitest";
import { DEFAULT_API_BASE_URL, resolveApiConfig } from "@/config/api.config";

describe("resolveApiConfig", () => {
  it("defaults to mock mode and the default base URL", () => {
    const config = resolveApiConfig({});
    expect(config.mode).toBe("mock");
    expect(config.baseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(config.warnings).toEqual([]);
  });

  it("reads NEXT_PUBLIC_API_MODE and strips trailing slashes from the base URL", () => {
    const config = resolveApiConfig({ mode: "real", baseUrl: "https://api.example.gov.ph/api//" });
    expect(config.mode).toBe("real");
    expect(config.baseUrl).toBe("https://api.example.gov.ph/api");
  });

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

  it("rejects a base URL that is not http(s) or a path", () => {
    const config = resolveApiConfig({ mode: "real", baseUrl: "ftp://x" });
    expect(config.baseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(config.warnings.length).toBe(1);
  });

  it("clamps numeric settings", () => {
    const config = resolveApiConfig({ timeoutMs: "5", mockDelayMs: "abc", mockFailureRate: "3" });
    expect(config.timeoutMs).toBe(1000);
    expect(config.mockDelayMs).toBe(450);
    expect(config.mockFailureRate).toBe(1);
  });
});
