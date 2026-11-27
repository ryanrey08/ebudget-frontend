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
  /**
   * Data API base URL without a trailing slash. Defaults to the same-origin
   * data proxy `/api/backend` (src/app/api/backend), which forwards to the
   * backend's /api/v1/{system} routes with the httpOnly session token. An
   * absolute URL calls a backend directly (it must then allow CORS and accept
   * a bearer token set with setAuthToken).
   */
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
  /**
   * Real mode: keep answering the modules that have no backend endpoints yet
   * (dashboard, obligations, RAO registries, BFARS, reports, notifications,
   * profile) from the demo data instead of failing with 404. Pages using it
   * show a "demo data" notice. Default true (NEXT_PUBLIC_API_DEMO_MODULES).
   */
  demoModules: boolean;
  /** Problems found while reading the configuration (shown in dev only). */
  warnings: string[];
}

/** Same-origin data proxy (src/app/api/backend/[...path]). */
export const BACKEND_PROXY_BASE_URL = "/api/backend";
export const DEFAULT_API_BASE_URL = BACKEND_PROXY_BASE_URL;

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
  demoModules?: string;
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
    baseUrl = DEFAULT_API_BASE_URL; // the same-origin data proxy
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
    demoModules: raw.demoModules?.trim().toLowerCase() !== "false",
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
    demoModules: process.env.NEXT_PUBLIC_API_DEMO_MODULES,
  }),
);

export const isMockApi = () => apiConfig.mode === "mock";
export const isMockAuth = () => apiConfig.authMode === "mock";
/** Whether the eBudget backend's data endpoints are in use (NEXT_PUBLIC_API_MODE=real). */
export const isBackendData = () => apiConfig.mode === "real";

/**
 * Paths of the modules the backend has no endpoints for yet. In real mode
 * they are answered by the demo (mock) API when `demoModules` is on. Keep this
 * list in sync with docs/FRONTEND_API_INTEGRATION_AUDIT.md.
 */
export const DEMO_ONLY_PATHS: readonly RegExp[] = [
  /^\/dashboard(\/|$)/,
  /^\/obligations(\/|$)/,
  /^\/allotment-classes\//, // RAO registries (the backend's classes live under /master-data)
  /^\/allotments\/registry(\/|$)/,
  /^\/allotments\/[^/]+\/registry$/,
  /^\/bfars(\/|$)/,
  /^\/reports(\/(history|generate)(\/|$)|$)/,
  /^\/notifications(\/|$)/,
  /^\/profile(\/|$)/,
];

export const isDemoOnlyPath = (url: string) => {
  const path = `/${url.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "")}`.split("?")[0];
  return DEMO_ONLY_PATHS.some((re) => re.test(path));
};

/**
 * Same-origin base path of the Next.js auth proxy (src/app/api/auth/*). The
 * browser never calls the backend's auth endpoints directly.
 */
export const AUTH_PROXY_BASE_URL = "/api";

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  for (const warning of apiConfig.warnings) console.warn(`[api config] ${warning}`);
}
