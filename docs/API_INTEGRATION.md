# API integration

The official endpoint-by-endpoint comparison is in
[API_DOCUMENTATION_AUDIT.md](API_DOCUMENTATION_AUDIT.md) (2026-11-27, against the hosted OpenAPI
docs at `http://139.59.96.9/docs/ebudget`: 94 of 94 endpoints correct and used by a page).

## 2026-11-26: synchronised with backend-api `main` (`ea276fd`)

The backend gained the eBudget data modules after the auth-only sync of 2026-11-12. This round
integrates them. Details: [BACKEND_API_CHANGE_AUDIT.md](BACKEND_API_CHANGE_AUDIT.md) (every endpoint,
classified) and [FRONTEND_API_INTEGRATION_AUDIT.md](FRONTEND_API_INTEGRATION_AUDIT.md) (every page →
endpoint, with status).

### Setup

```env
# NEXT_PUBLIC_API_MODE=real          # default since 2026-11-27; set "mock" only to run without a backend
NEXT_PUBLIC_AUTH_MODE=real
NEXT_PUBLIC_API_BASE_URL=/api/v1 # same-origin data proxy (default)
NEXT_PUBLIC_API_DEMO_MODULES=true     # modules without endpoints keep demo data
BACKEND_API_URL=http://localhost:8080/api/v1   # server-only
BACKEND_SYSTEM=ebudget                         # server-only
```

Restart `npm run dev` after changing them. The backend needs its migrations (`make migrate`), the
seeders (`make seed`: allotment classes, agency profile) and a queue worker listening on `imports`
for the GAA import.

### How requests flow

```
page → RTK Query hook (src/features/<module>/services/*Api.ts, injected into the one root api)
     → backend service (src/services/backend/*.service.ts, requests marked requiresBackend)
     → apiClient (src/lib/api/api-client.ts)
     → /api/v1/<path>   (Next route handler, adds Authorization: Bearer from the httpOnly cookie)
     → {BACKEND_API_URL}/ebudget/<path>
```

- The token never reaches the browser; the backend allows no browser origin in CORS, so the
  same-origin proxy is the only data path. It passes JSON, multipart uploads and file downloads,
  rewrites `Location`, clears the cookie on 401 and applies the same CSRF checks as the auth proxy.
- Files behind the token (agency logo, e-signatures, allotment documents) are fetched through the
  client and shown via blob URLs or saved as downloads (`backendPath()` maps their absolute URLs).
- Errors keep the backend's problem `code` in `ApiError.problemCode` and its `detail` as the message;
  422 field errors land on the form fields (GAA import: `lines.{i}.cells.{field}` → the row's cell).
- Lists keep extra `meta` (`total_amount`) in `Paginated.meta`.
- Paths of modules without backend endpoints (`DEMO_ONLY_PATHS`) are answered by the demo API in
  real mode; those pages show a "Demo data" notice. In mock mode the backend-only pages say they
  need `NEXT_PUBLIC_API_MODE=real` instead of reaching a demo handler with another contract.
- Navigation items and actions are shown by `GET /auth/me` permissions (`useCan`, sidebar filter);
  the backend still authorises every call.

### Endpoint organisation

| Layer | Where | Rule |
|---|---|---|
| Paths | `BACKEND` in `src/lib/api/endpoints.ts` | One constant per documented route, relative to `/api/v1/ebudget` |
| Contracts | `src/features/<module>/types*.ts`, `src/types/backend.ts` | Field for field as the API resources; money is `PesoString`, ids `number` or `Ulid` |
| Services | `src/services/backend/<module>.service.ts` | Use the `backend` helper (marks `requiresBackend`); no UI code |
| Cache | `src/features/<module>/services/*Api.ts` | `api.injectEndpoints` on the one root api (`src/store/services/api.ts`), `queryFn: fromService(...)`, tags for lists (`LIST`) and items (`id`) |
| UI | pages in `src/app/(dashboard)`, views in `src/features/<module>/components` | Only the generated hooks |

### Using the hooks

```tsx
const fy = useBackendFiscalYear();                                   // header year → fiscal_year_id
const lines = useGetAppropriationLinesQuery({ fiscal_year_id: fy.id, page, per_page: 15 }, { skip: !fy.id });
const [create, { isLoading }] = useCreateAppropriationLineMutation();

lines.data?.items;                       // rows
lines.data?.meta?.total_amount;          // extra list meta
lines.isFetching && !lines.currentData;  // first load → skeleton
lines.error;                             // ApiError: status, code, message, fieldErrors, problemCode

try {
  await create(input).unwrap();          // invalidates the list automatically
} catch (err) {
  if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);      // 422 per field
  else if (isApiError(err) && err.problemCode === "fiscal_year_not_open") …  // 409 by code
}
```

Permissions for showing actions: `useCan("appropriations.manage")` (UI only; the backend decides).

### Adding a future integration

1. Read the endpoint in the OpenAPI docs (`/docs/ebudget`, JSON at `/docs/ebudget.json`) and its
   form request / resource in `backend-api`.
2. Add the path to `BACKEND`, the response and input types next to the feature.
3. Add the service function with `backend.get/post/patch/put/delete/upload/download`.
4. Inject the RTK endpoint with `providesTags` / `invalidatesTags`; export its hook.
5. Use the hook in the page; map 422 `errors` onto the form and show `detail` for 409/403.
6. If it replaces a demo module, remove its pattern from `DEMO_ONLY_PATHS` (and the demo notice).
7. Add a test with a fetch stub in the documented format (see `tests/backend-services.test.ts`), and a
   row in API_DOCUMENTATION_AUDIT.md.

### Pages integrated

Appropriations (list, create, new edit page), GAA Upload (validate → correct → configure → queued
import with polling), Allotments (list, create / next tranche, detail with tranches, submit, cancel,
documents), approval requests (`/approvals/{id}`, approve with e-signature, reject), Master Data
(fiscal years with close/reopen/lock, organizations, PREXC items, UACS objects, fund sources,
allotment classes), Administration (users with one-time password, roles & permissions,
signatories, approval workflows, agency profile with logo), change password, report datasets &
sharing, header fiscal-year list.

Still on demo data (no backend endpoints): dashboard, obligations, RAO registries
(RAOPS/RAOMO/RAOCO/RAOFE), BFARS 1–11, report catalog/history, notifications.

### Files

**Created:** `src/app/api/v1/[...path]/route.ts (src/lib/server/backend-proxy.ts)`, `src/app/api/auth/password/route.ts`;
`src/services/backend/*` (http, master-data, appropriations, allotments, approvals, administration,
access); `src/types/backend.ts`; `src/features/master-data/*`, `src/features/access/*`,
`src/features/administration/*`, `src/features/approvals/*`;
`src/features/appropriations/{types/lines.ts, services/appropriationLinesApi.ts, components/lines/*,
components/gaa-upload/Gaa{Upload,Validate,Configure,Import}Step.tsx}`;
`src/features/allotments/{types/records.ts, services/allotmentRecordsApi.ts, components/records/*}`;
`src/components/backend/*` (ResourceManager, PromptDialog, AuthorizedImage, DataSourceNotice);
`src/hooks/{useCan,useBackendFiscalYear}.ts`; pages under `src/app/(dashboard)/{master-data,
administration, approvals}`, `appropriations/appropriations/[lineId]/edit`; layouts with the demo
notice for obligations, allotment classes and BFARS; `tests/backend-proxy.test.ts`,
`tests/backend-services.test.ts`; the two audit docs.

**Modified:** `src/config/api.config.ts` (proxy default, `demoModules`, `DEMO_ONLY_PATHS`),
`src/lib/api/{api-client,api-error,api-response,api-types,endpoints}.ts`,
`src/lib/server/backend-auth.ts`, `src/store/services/api.ts` (tag types),
`src/store/slices/filtersSlice.ts`, `src/components/layout/{Header,Sidebar}.tsx`,
`src/config/navigation.ts`, `src/lib/constants/routes.ts`, `src/features/auth/types` (full
permission catalog), settings (password change), GAA wizard slice/stepper/workflow, the five
appropriation/allotment page files, dashboard and reports views (notices, sharing card),
`src/hooks/useRoutePrefetch.ts`, `src/mocks/handlers/auth.ts` (demo users hold every permission),
`StatusBadge`, `.env.example`, `Dockerfile`, `docker-compose.{dev,prod}.yml`, `docker/README.md`,
`tests/api-client.real.test.ts`.

**Removed:** the demo-contract appropriation, GAA batch and allotment workflow views and their
schemas (list in the frontend audit).

### Checks (2026-11-26)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npx eslint src tests` | Clean |
| `npx vitest run` | 97 passed (8 files, 2026-11-27) |
| `next build` (real mode, in a copy so the running dev server was untouched) | Succeeded, all 77 routes |

### Runtime verification

**2026-11-27: verified live on the local backend** — 91 of 94 endpoints called through the frontend proxies, success and error paths, and 23 pages opened signed in. Not called: fiscal-year lock (permanent), deleting an allotment class (only the seeded, in-use ones exist), deleting a report share (no eBudget datasets exist to share). A successful password change was skipped to keep your password; its validation path was tested. One mismatch found and fixed (attachment upload response). Details and the test data left behind: [API_DOCUMENTATION_AUDIT.md](API_DOCUMENTATION_AUDIT.md#live-verification-on-the-local-backend-2026-11-27).

Earlier notes:

2026-11-27: read-only checks against the hosted server `139.59.96.9` passed through the frontend's
auth and data proxies (documented 401/422 problem details, cookie cleared on a rejected token); see
API_DOCUMENTATION_AUDIT.md. Signed-in flows still untested: no application account for the hosted
server, and the local stack's `make migrate` needs `AUDIT_CHAIN_KEY` in the backend `.env`.

Not done against the live backend: on 2026-11-26 Docker was stopped and the `laravel-api`
containers didn't exist; starting them needs `make build`, `make up`, `make migrate` and `make seed`,
which change the local backend database, and that was not approved. So every backend integration
is verified by unit tests with fetch stubs in the backend's documented formats, TypeScript and the
production build, but **no request has reached the real backend**. Status in the frontend audit is
"Integrated (not runtime-tested)" for all of them. To verify: start the stack, sign in, then walk
Master Data → Fiscal Years (add FY 2026) → master data → Appropriations / GAA Upload → Allotments →
Approval Workflows (an active `allotment` workflow) → submit and approve a tranche.

### Remaining issues

- No approval inbox: the backend can't list requests awaiting a user.
- Users list has no backend search (filters the current page); signatory, workflow and PREXC parent
  pickers load the first 100 records.
- Allotments list: released/pending cards cover the visible page only (the list has no totals for them).
- The old appropriations CSV export, column picker and charts were removed with the demo contract.
- Dashboard, obligations, RAO registries, BFARS, report catalog/history and notifications await
  backend endpoints.

---

## 2026-11-05: API integration architecture (mock/real switch)

## How to switch to a real backend

```env
NEXT_PUBLIC_API_MODE=real
# server-only: where the Next.js server reaches the backend
BACKEND_API_URL=http://10.15.0.14/api/v1
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
