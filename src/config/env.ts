/**
 * Runtime configuration read from NEXT_PUBLIC_* environment variables.
 * Values are inlined at build time by Next.js, so reference them statically.
 */
export const env = {
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, ""),
  useMockApi: (process.env.NEXT_PUBLIC_USE_MOCK_API ?? "true") !== "false",
  mockApiDelayMs: Number(process.env.NEXT_PUBLIC_MOCK_API_DELAY_MS ?? 450),
} as const;
