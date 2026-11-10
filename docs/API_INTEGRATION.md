# API integration architecture — change summary (2026-11-05)

## How to switch to a real backend

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com/api
NEXT_PUBLIC_API_MODE=real
```

Restart `npm run dev` or rebuild. No page, component, slice or service changes are needed. Endpoint contract: [API_ENDPOINTS.md](API_ENDPOINTS.md).

Request flow: page → RTK Query hook (`src/features/*/services/*Api.ts`) → service (`src/services/*.service.ts`) → `apiClient` (`src/lib/api/api-client.ts`) → mock API (`src/mocks/mock-api.ts`) or `fetch`.

## Created

| File | Purpose |
| --- | --- |
| `src/config/api.config.ts` | Reads/validates `NEXT_PUBLIC_API_MODE`, base URL, timeout, credentials, mock delay/failure rate/persistence |
| `src/lib/api/api-client.ts` | Single HTTP client: GET/POST/PUT/PATCH/DELETE, upload (FormData), download (Blob + file name), query strings, timeouts, bearer token, 401/403 events; mock or fetch transport; no fallback to mock in real mode |
| `src/lib/api/api-error.ts` | `ApiRequestError`, status → code mapping, safe messages (5xx details hidden), Laravel field errors |
| `src/lib/api/api-response.ts` | Envelope / Laravel paginator / JsonResource normalisation (`setResponseNormalizer` to adapt) |
| `src/lib/api/api-types.ts` | Request config, envelope, pagination meta, downloaded file types |
| `src/lib/api/auth-token.ts` | Optional bearer token (memory + sessionStorage) and auth events |
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
