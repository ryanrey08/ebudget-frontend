import { apiConfig } from "./api.config";

/**
 * Runtime configuration read from NEXT_PUBLIC_* environment variables.
 * Kept for existing imports; the source of truth is `api.config.ts`.
 */
export const env = {
  apiMode: apiConfig.mode,
  apiBaseUrl: apiConfig.baseUrl,
  useMockApi: apiConfig.mode === "mock",
  authMode: apiConfig.authMode,
  /** Authentication uses the in-browser mock (demo accounts) instead of the backend. */
  useMockAuth: apiConfig.authMode === "mock",
  mockApiDelayMs: apiConfig.mockDelayMs,
} as const;
