# API integration architecture — change summary (2026-11-05)

## How to switch to a real backend

```env
NEXT_PUBLIC_API_MODE=real
# server-only: where the Next.js server reaches the backend
BACKEND_API_URL=http://10.104.0.8/api/v1
BACKEND_SYSTEM=ebudget
```

Restart `npm run dev` or rebuild. No page, component, slice or service changes are needed. Endpoint contract: [API_ENDPOINTS.md](API_ENDPOINTS.md).

Request flow: page → RTK Query hook (`src/features/*/services/*Api.ts`) → service (`src/services/*.service.ts`) → `apiClient` (`src/lib/api/api-client.ts`) → mock API (`src/mocks/mock-api.ts`) or `fetch` to the same-origin data proxy.

## The browser never calls the backend directly

```
browser ──(same origin, httpOnly cookie)──▶ /api/auth/*  ──(Bearer)──▶ {BACKEND_API_URL}/{system}/auth/*
browser ──(same origin, httpOnly cookie)──▶ /api/v1/<path> ──(Bearer)──▶ {BACKEND_API_URL}/{system}/<path>
```

In real mode `apiClient` sends data requests to `/api/v1` (`DATA_PROXY_BASE_URL` in `src/config/api.config.ts`) with `credentials: "same-origin"`. `NEXT_PUBLIC_API_BASE_URL` may only change that to another same-origin path; a full URL is ignored with a warning. The catch-all route handler `src/app/api/v1/[...path]/route.ts` (logic in `src/lib/server/backend-proxy.ts`) forwards GET/POST/PUT/PATCH/DELETE to the backend:

- **Token:** `Authorization: Bearer <token>` from the httpOnly `ebudget_session` cookie set by the auth proxy. The token never reaches the browser; any `Authorization` or `Cookie` header the browser sends is not forwarded. Without a cookie the proxy answers 401 and does not call the backend.
- **Paths:** endpoint paths carry no system, so `/api/v1/appropriations?page=2` goes to `{BACKEND_API_URL}/{BACKEND_SYSTEM}/appropriations?page=2`, the backend's `/api/v1/{system}/...` layout. `/api/v1/auth/*`, empty or dot segments and encoded slashes are refused with 404 (sign-in stays on `/api/auth/*`, which keeps the token out of response bodies).
- **CSRF:** the same check as the auth routes (`rejectCrossSite`): `Sec-Fetch-Site` must be `same-origin`, `Origin` must match `Host` / `X-Forwarded-Host`, and `X-Requested-With: XMLHttpRequest` (always sent by `apiClient`) is required, on every method.
- **Headers:** `X-Forwarded-For` and a well-formed `X-Request-Id` are passed on exactly as by the auth proxy (`setForwardingHeaders`), so the backend rate-limits per browser. Also forwarded: `Accept`, `Accept-Language`, `Content-Type` and conditional headers.
- **Bodies:** request bodies are passed through byte for byte, multipart boundary included (buffered so the backend gets a `Content-Length`). Successful responses are streamed back with `Content-Type`, `Content-Disposition` (file downloads), `ETag`, `Last-Modified`, `Retry-After`, `X-Request-Id` and rate-limit headers; backend cookies and server headers are dropped.
- **Errors:** backend problem+json errors pass through unchanged (`forwardError`); a non-JSON error page becomes 502. A backend redirect becomes 502 instead of sending the browser to the backend's host. Unreachable backend → 503, no response headers within `BACKEND_TIMEOUT_MS` → 504.
- **Session expiry:** a backend 401 is passed through and clears the session cookie; `apiClient` then emits `unauthorized`, so the app signs out and shows "Session expired" (`StoreProvider`, `apiErrorListener`).
- Every response is `Cache-Control: no-store`, and every backend call uses `cache: "no-store"`.

Because only the Next.js server talks to the backend, the backend needs no CORS rules for the browser, no public address (it can stay on the private network with its public ports closed) and no HTTPS of its own while the frontend is served over HTTPS (no mixed content). The backend should trust `X-Forwarded-For` only from the frontend server's private address.

Tests: `tests/data-proxy.test.ts` (proxy), `tests/api-client.real.test.ts` (client), `tests/redux.test.ts` (401 → session expired).

## Created

| File | Purpose |
| --- | --- |
| `src/config/api.config.ts` | Reads/validates `NEXT_PUBLIC_API_MODE`, same-origin data proxy path, timeout, mock delay/failure rate/persistence |
| `src/lib/api/api-client.ts` | Single HTTP client: GET/POST/PUT/PATCH/DELETE, upload (FormData), download (Blob + file name), query strings, timeouts, bearer token, 401/403 events; mock or fetch transport; no fallback to mock in real mode |
| `src/lib/api/api-error.ts` | `ApiRequestError`, status → code mapping, safe messages (5xx details hidden), Laravel field errors |
| `src/lib/api/api-response.ts` | Envelope / Laravel paginator / JsonResource normalisation (`setResponseNormalizer` to adapt) |
| `src/lib/api/api-types.ts` | Request config, envelope, pagination meta, downloaded file types |
| `src/lib/api/auth-token.ts` | Auth events (401/403); its optional bearer token is not used in real mode, where the data proxy attaches the token |
| `src/app/api/v1/[...path]/route.ts`, `src/lib/server/backend-proxy.ts` | Same-origin data proxy for real mode (see above) |
| `src/services/*.service.ts` + `index.ts` | auth, settings + notifications, dashboard, appropriations + GAA, allotments + allotment classes, obligations, BFARS 1–11 (`getBFARSn`, `generateBFARSn`, `getGeneratedBFARSn`), reports |
| `src/mocks/mock-api.ts` | Mock transport: same paths, `{ success, data }` envelope, HTTP-status errors, simulated latency/failures, `__EBUDGET_MOCK__.failNext()` |
| `src/mocks/services/persistence.ts` | Opt-in localStorage persistence of the mock DB |
| `src/mocks/handlers/report-generation.ts` | `POST /bfars/{id}/generate`, `GET /bfars/{id}/generated`, `GET /reports/history/{id}/download` |
| `src/features/bfars-reporting/hooks/useRecordGeneration.ts` | Records BFARS generations in the report history |
| `src/features/settings/types/index.ts` | Profile request types (moved from profileApi) |
| `tests/*.test.ts`, `vitest.config.mts` | 72 unit tests (config, normalisation, real-mode client with mocked fetch, mock API CRUD/relationships/BFARS, Redux) |
| `docs/API_ENDPOINTS.md`, `docs/API_INTEGRATION.md` | Endpoint specification and this summary |

## Modified

- `src/lib/api/client.ts` (RTK base query now delegates to `apiClient`; `fromService` helper), `error-handler.ts`, `endpoints.ts` (BFARS generate/generated, report download), `src/config/env.ts`, `src/types/api.ts` (`ApiError.code`).
- All RTK Query endpoint files now call services via `queryFn` (hook names, tags and invalidation unchanged): auth, profile, notifications, dashboard, appropriations, GAA, allotments, allotment classes, obligations, BFARS, reports.
- BFARS 1–11 generators: record each generated report; error toasts now show the API message.
- Reports page: Download button per generated report. `ErrorState`: connection / access-denied / not-found titles.
- `AppShell` + `authSlice`: a session check that fails because the backend is unreachable shows "Cannot connect to the server" with retry instead of signing out (only 401/403/404 sign out).
- `StoreProvider`: 401 from any request ends the session. `src/mocks/services/db.ts`: persistence hook. `src/mocks/handlers/index.ts`.
- `.env.example`, `.env.local` (`NEXT_PUBLIC_API_MODE=mock`), `package.json` (`test` scripts, vitest), `README.md`, `docs/API.md`.
- Removed `src/mocks/mock-base-query.ts` (replaced by `mock-api.ts`).

## Known gaps / rules not invented

- **User Management and Role & Permission Management** do not exist in the app, so no pages or services were added; suggested routes are listed in API_ENDPOINTS.md §14.
- **BFARS mock data** still comes from the workbook-derived datasets in `src/mocks/data/*` (as built in the BFARS threads), not from the live appropriation/allotment/obligation tables, so creating an obligation does not change BFARS figures in mock mode. With a real backend the reports use whatever the backend returns.
- Dashboard "Total Appropriations" includes draft appropriations while the Appropriations summary excludes them (existing behaviour, kept).
- Role checks per workflow step are enforced by the mock only where already implemented; the backend must enforce them.
