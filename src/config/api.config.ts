/**
 * Centralized API configuration.
 *
 * Every request in the app goes through `src/lib/api/api-client.ts`, which
 * reads its settings from here. Switching between the mock API and a real
 * backend only requires changing the environment variables below:
 *
 *   NEXT_PUBLIC_API_MODE=mock | real
 *   NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com/api
 *
 * NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
 * only public, non-sensitive settings may live here. Never put API keys,
 * database credentials or other secrets in NEXT_PUBLIC_* variables.
 *
 * Next.js only inlines variables that are referenced statically
 * (`process.env.NEXT_PUBLIC_X`), so each one is read explicitly below.
 */

export type ApiMode = "mock" | "real";

export interface ApiConfig {
  /** Where requests are answered: the in-browser mock API or the backend. */
  mode: ApiMode;
  /**
   * Where authentication requests (/auth/*) are answered. "real" sends them to
   * the same-origin auth proxy (src/app/api/auth), which talks to the backend
   * and keeps the access token in an httpOnly cookie. Defaults to `mode`, so
   * real backend auth can be combined with mock data while the eBudget data
   * endpoints do not exist in the backend yet.
   */
  authMode: ApiMode;
  /** Backend base URL without a trailing slash, e.g. http://localhost:8000/api */
  baseUrl: string;
  /** Request timeout for real requests, in milliseconds. */
  timeoutMs: number;
  /** Send cookies with requests (needed for the httpOnly session cookie). */
  withCredentials: boolean;
  /** Simulated latency of the mock API, in milliseconds. */
  mockDelayMs: number;
  /** Share (0–1) of mock requests that fail with a simulated server error. */
  mockFailureRate: number;
  /** Persist the mock database in localStorage so changes survive a reload. */
  mockPersist: boolean;
  /** Problems found while reading the configuration (shown in dev only). */
  warnings: string[];
}

export const DEFAULT_API_BASE_URL = "http://localhost:8000/api";

interface RawApiEnv {
  mode?: string;
  authMode?: string;
  legacyUseMock?: string;
  baseUrl?: string;
  timeoutMs?: string;
  withCredentials?: string;
  mockDelayMs?: string;
  mockFailureRate?: string;
  mockPersist?: string;
}

function toNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (value === undefined || value === "" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Reads and validates the raw environment values. Exported (pure) so the
 * rules can be unit tested without touching process.env.
 */
export function resolveApiConfig(raw: RawApiEnv): ApiConfig {
  const warnings: string[] = [];

  let mode: ApiMode;
  const requested = raw.mode?.trim().toLowerCase();
  if (requested === "mock" || requested === "real") {
    mode = requested;
  } else {
    if (requested) warnings.push(`NEXT_PUBLIC_API_MODE="${raw.mode}" is not supported (use "mock" or "real"); falling back.`);
    // Backwards compatibility with the earlier NEXT_PUBLIC_USE_MOCK_API flag.
    mode = raw.legacyUseMock?.trim().toLowerCase() === "false" ? "real" : "mock";
  }

  let authMode: ApiMode = mode;
  const requestedAuth = raw.authMode?.trim().toLowerCase();
  if (requestedAuth === "mock" || requestedAuth === "real") authMode = requestedAuth;
  else if (requestedAuth) warnings.push(`NEXT_PUBLIC_AUTH_MODE="${raw.authMode}" is not supported (use "mock" or "real"); using "${mode}".`);

  let baseUrl = (raw.baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    baseUrl = DEFAULT_API_BASE_URL;
    if (mode === "real") warnings.push(`NEXT_PUBLIC_API_BASE_URL is not set; using ${DEFAULT_API_BASE_URL}.`);
  } else if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith("/")) {
    warnings.push(`NEXT_PUBLIC_API_BASE_URL="${raw.baseUrl}" must be an absolute http(s) URL or a path starting with "/"; using ${DEFAULT_API_BASE_URL}.`);
    baseUrl = DEFAULT_API_BASE_URL;
  }

  return {
    mode,
    authMode,
    baseUrl,
    timeoutMs: toNumber(raw.timeoutMs, 30_000, 1_000, 300_000),
    withCredentials: raw.withCredentials?.trim().toLowerCase() !== "false",
    mockDelayMs: toNumber(raw.mockDelayMs, 150, 0, 10_000),
    mockFailureRate: toNumber(raw.mockFailureRate, 0, 0, 1),
    mockPersist: raw.mockPersist?.trim().toLowerCase() === "true",
    warnings,
  };
}

export const apiConfig: Readonly<ApiConfig> = Object.freeze(
  resolveApiConfig({
    mode: process.env.NEXT_PUBLIC_API_MODE,
    authMode: process.env.NEXT_PUBLIC_AUTH_MODE,
    legacyUseMock: process.env.NEXT_PUBLIC_USE_MOCK_API,
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    timeoutMs: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
    withCredentials: process.env.NEXT_PUBLIC_API_WITH_CREDENTIALS,
    mockDelayMs: process.env.NEXT_PUBLIC_MOCK_API_DELAY_MS,
    mockFailureRate: process.env.NEXT_PUBLIC_MOCK_API_FAILURE_RATE,
    mockPersist: process.env.NEXT_PUBLIC_MOCK_API_PERSIST,
  }),
);

export const isMockApi = () => apiConfig.mode === "mock";
export const isMockAuth = () => apiConfig.authMode === "mock";

/**
 * Same-origin base path of the Next.js auth proxy (src/app/api/auth/*). The
 * browser never calls the backend's auth endpoints directly.
 */
export const AUTH_PROXY_BASE_URL = "/api";

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  for (const warning of apiConfig.warnings) console.warn(`[api config] ${warning}`);
}
