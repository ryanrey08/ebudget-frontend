# eBudget

eBudget is a budget management frontend for appropriations, allotments, obligations and BFARS financial reporting. It covers the full workflow of a budget office: uploading the General Appropriations Act (GAA), importing it as appropriations, issuing allotments, recording obligations, monitoring the allotment class registries (RAOPS, RAOMO, RAOCO, RAOFE) and producing BFARS 1–11 reports.

There is no backend yet. Every request is served by an in-browser **mock API** with realistic sample data, and the API layer is built so the real backend can be plugged in by changing an environment variable.

## Technology stack

| Concern | Library |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Global state | Redux Toolkit, React Redux |
| Data fetching & caching | RTK Query (`fetchBaseQuery` on native `fetch`) |
| Forms & validation | React Hook Form, Zod, `@hookform/resolvers` |
| Charts | Recharts |
| Icons | Lucide React |

## Getting started

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local   # already created for local development
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # unit tests (Vitest): API config, client, normalisation, mock API
npm run build       # production build
npm start           # serve the production build
```

### Demo accounts (mock API only)

| Email | Password | Role |
| --- | --- | --- |
| juan.delacruz@mpc.edu.ph | eBudget@2026 | Budget Officer |
| ana.villanueva@mpc.edu.ph | eBudget@2026 | Budget Head |
| maria.santos@mpc.edu.ph | eBudget@2026 | Accountant |
| antonio.reyes@mpc.edu.ph | eBudget@2026 | Head of Agency |

The login page has a **Use demo account** shortcut while the mock API is enabled.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` answers every request from `src/mocks`; `real` calls the backend |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000/api` | Base URL of the backend API |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | `30000` | Request timeout (real mode) |
| `NEXT_PUBLIC_API_WITH_CREDENTIALS` | `true` | Send the session cookie with requests |
| `NEXT_PUBLIC_MOCK_API_DELAY_MS` | `450` | Simulated latency for mock requests |
| `NEXT_PUBLIC_MOCK_API_FAILURE_RATE` | `0` | Share (0–1) of mock requests that fail with 503, to test error states |
| `NEXT_PUBLIC_MOCK_API_PERSIST` | `false` | Keep mock data changes in localStorage across reloads |

They are read and validated once in `src/config/api.config.ts` (`src/config/env.ts` re-exports them); nothing else reads `process.env` or hard-codes an API URL. The older `NEXT_PUBLIC_USE_MOCK_API=false` still works when `NEXT_PUBLIC_API_MODE` is not set. `NEXT_PUBLIC_*` values end up in the browser bundle, so never put secrets in them. See `.env.example`.

## Project structure

```
src/
├── config/                      api.config.ts (API mode, base URL…), env.ts, navigation, site
├── app/                         Next.js routes
│   ├── (auth)/                  login, register, forgot-password, reset-password
│   ├── (dashboard)/             authenticated pages (AppShell layout)
│   │   ├── dashboard/
│   │   ├── appropriations/{gaa-upload,appropriations,allotments}/
│   │   ├── obligation-management/
│   │   ├── allotment-classes/[classSlug]/      raop, raomo, raoco, raofe (static params)
│   │   ├── bfars-reporting/[reportId]/         bfars-1 … bfars-11 (static params)
│   │   ├── reports/
│   │   └── settings/profile/
│   ├── StoreProvider.tsx        per-client Redux store
│   ├── layout.tsx               fonts, metadata ("eBudget"), providers, toaster
│   └── globals.css              Tailwind theme tokens (brand red, sidebar, chart colours)
├── components/
│   ├── ui/                      Button, Card, Badge, Input, Select, Modal, Tabs, Pagination…
│   ├── layout/                  AppShell, Header, Sidebar, PageHeader, UserMenu
│   ├── forms/                   FormField, PasswordInput, FormAlert, applyServerErrors
│   ├── tables/                  DataTable (loading / empty / error states)
│   ├── charts/                  GroupedBarChart, DonutChart, AreaTrendChart
│   └── shared/                  StatCard, StatusBadge, SearchInput, FilterBar, Logo, Toaster…
├── features/<feature>/          components, services (RTK Query endpoints), schemas, types
├── store/
│   ├── index.ts                 makeStore() factory, RootState, AppDispatch
│   ├── hooks.ts                 useAppDispatch, useAppSelector, useAppStore
│   ├── services/api.ts          root createApi()
│   ├── slices/                  authSlice, uiSlice, filtersSlice, alertsSlice
│   └── middleware/              central API error listener
├── lib/
│   ├── api/                     api-client.ts, api-error.ts, api-response.ts, api-types.ts,
│   │                            auth-token.ts, client.ts (RTK base query), endpoints.ts
│   ├── auth/session.ts          session cookie name, redirect helpers
│   ├── constants/               routes, allotment classes, BFARS report list, options
│   └── utils/                   formatting, CSV export, cn()
├── mocks/
│   ├── data/                    seed data (users, budget, GAA, BFARS, reports, notifications)
│   ├── handlers/                mock route handlers per domain
│   ├── services/                in-memory db, session cookie, GAA validation, HTTP helpers
│   └── mock-api.ts              answers API client requests from the handlers (mock mode)
├── services/                    one service per module (*.service.ts), used by the RTK Query endpoints
├── hooks/                       useFiscalYear, useNotify, useDebouncedValue…
├── config/                      env, site (name, agencies, fiscal years), navigation tree
├── types/                       shared API types (Paginated, ApiError)
└── middleware.ts                route protection based on the session cookie
```

## Sidebar navigation and modules

| Menu | Route(s) | What it does |
| --- | --- | --- |
| Dashboard | `/dashboard` | Summary cards, budget utilisation chart, allocation by class, recent transactions, quick actions |
| Appropriations › GAA Upload | `/appropriations/gaa-upload` | 4-step workflow: Upload File → Validate Data → Map & Configure → Import to System (see below) |
| Appropriations › Appropriations | `/appropriations/appropriations` | Summary cards, fund source / program / class filters with search, category tabs, paginated table with row actions (view, create allotment, delete), CSV export, column settings, summaries by allotment class and fund source |
| ↳ New Appropriation | `/appropriations/appropriations/new` | Four-section form (general information, budget details, additional details, supporting documents) with live summary, validation checklist, Save as Draft and Create |
| Appropriations › Allotments | `/appropriations/allotments` | Summary cards, filters, monthly release and by-class charts, status tabs, table with row actions, CSV export, BFARS 4 shortcut |
| ↳ New Allotment | `/appropriations/allotments/new` | Appropriation lookup with remaining balance, allotment/tranche/release details, documents, workflow preview, Save as Draft / Submit for Approval |
| ↳ Allotment approval | `/appropriations/allotments/:id` | 5-step workflow: Prepared → Review by Budget Head → Approved by Accountant → Certify by Head of Agency → Released, with checklists, remarks, audit trail, Return / Reject / Approve |
| Obligation Management | `/obligation-management` | Summary cards, monthly and by-class charts, status tabs, filters (class, fund source, status, date range, search), selectable table with view/edit/more actions, CSV export |
| ↳ New / Edit Obligation | `/obligation-management/new`, `/obligation-management/:id/edit` | Basic information, line items (with PR/PO and APP import), reference documents, attachments, allotment balance, applicable documents, Save as Draft / Submit for Approval |
| ↳ Obligation approval | `/obligation-management/:id` | Encode Details → Submit for Approval → Review by Budget Head → Approved by Accountant → Certified by Head of Agency → Released; remarks, Save as Draft, Back to Previous Step, Return for Revision, Reject, typed-name certification signature |
| Allotment Classes › RAOPS | `/allotment-classes/raop` | RAOPS Allotments: summary cards, Allotments / Obligations / Disbursements / Balances / Reports tabs, filters, allotment table with totals, utilization, tranche trend and top-department charts |
| ↳ New RAOPS Allotment | `/allotment-classes/raop/new`, `/allotment-classes/raop/:id/edit` | Allotment information, line items, supporting documents, summary; Save as Draft / Submit for Approval |
| ↳ RAOPS approval | `/allotment-classes/raop/:id` | Encode Details → Submit for Approval → Review and Approve (Budget Head) → Approved by Accountant → Certified by Head of Agency; decision (approve / return / reject), remarks, typed-name signature, checklist and history |
| Allotment Classes › RAOMO | `/allotment-classes/raomo` (+ `/new`, `/:id`, `/:id/edit`) | Same registry workflow as RAOPS with the RAOMO layout: status tabs, UACS column, Top UACS and Utilization charts; form adds Schedule/Validity, Allotment Summary and workflow preview; approval screens use Approve / Return / Reject / Cancel action buttons, an approval history table and Print Certification. Differences per class live in `src/features/allotment-classes/registryConfig.ts` |
| Allotment Classes › RAOCO | `/allotment-classes/raoco` (+ `/new`, `/:id`, `/:id/edit`) | Overview / Allotments / Obligations / Disbursements / Reports tabs, GAA reference and utilization columns, utilization donut, allotment vs obligations vs disbursements chart and Recent Transactions. New and edit use a 4-step wizard (`RegistryAllotmentWizard`): Allotment Details → Line Items (duplicate, Import from GAA, UACS lookup, remaining balance) → Supporting Documents (category, description, required-documents checklist) → Review and Submit. Submitting sends it to the Budget Head; approval reuses the RAOMO screens |
| Allotment Classes › RAOFE | `/allotment-classes/raofe` (+ `/new`, `/:id`, `/:id/edit`) | All RAOFE Allotments / Tranches / Obligations / Disbursements / Reports tabs; code, utilization and ⋯ actions columns; allocation by expense type donut and allotment vs obligations vs disbursements chart (bar or table). New and edit use `RaofeAllotmentWizard`: Allotment Details (UACS major and sub-object pick the reference appropriation; class information and available budget) → Line Items (category, UACS lookup tree, line item details panel, CSV template import/download) → Supporting Documents → Review and Submit with a Submit for Approval dialog and declaration. Submitting marks the record For Approval; the details page (`RaofeAllotmentView`) is view-only, with no approval actions |
| BFARS 1 – QPRO | `/bfars-reporting/bfars-1` (+ `/generate`) | Parameters (FY, quarter, department, UACS major, allotment class) with Generate Report; programs, physical target/accomplishment and financial utilization cards; physical vs financial chart by class and program-type donut; QPRO Details tabs (PAP, class, office, UACS) with search, pagination, Export to Excel (.xls), Export to PDF (print dialog) and Print. The generator adds PAP/fund source/status filters, format (PDF/Excel/Word), layout, scope and sections, with a paged preview. Data: `src/mocks/data/qpro.ts`, split from the BFARS 1 sample workbook; rates follow the workbook (accomplishment = actual ÷ target, utilization = disbursements ÷ allotment) |
| BFARS 2 – SAAODB | `/bfars-reporting/bfars-2` (+ `/generate`) | FY / department / UACS major / allotment class / quarter with Generate Report; five KPI cards; SAAODB table grouped by allotment class (object-of-expenditure lines, class totals, grand total, % utilization bars, remarks); grouped bar and obligations donut; Export to Excel (.xlsx), Export to PDF (print dialog), Print. The generator has report options (cover, summary, detailed breakdown, per-UACS listing, signature page), output format (PDF/XLSX/XLS) and a live paged preview with signatories. Data: `src/mocks/data/saaodb.ts` from the BFARS 2 sample workbook; unobligated = allotments − obligations, % utilization = disbursements ÷ allotments. `.xlsx` files are written by `src/lib/utils/xlsx.ts` (no dependency) |
| BFARS 3 – SAAODBOE | `/bfars-reporting/bfars-3` (+ `/generate`) | FY / quarter / department / UACS major / allotment class with Generate Report; five KPI cards; grouped bar and obligations donut by object class; SAAODBOE Details table per object class (PS 501, MOOE 502, CO 503, FE 504, Others 505) with % utilization bars, remarks, search and pagination; Export to Excel (.xlsx), Export to PDF (print dialog), Print. The generator has report options (cover, summary, detailed listing, total per UACS major, signature page), output format (PDF/XLSX/XLS) and a live paged preview of BFARS Form 3 (Annex C) with signatories. Data: `src/mocks/data/saaodboe.ts` from the BFARS 3 sample workbook; unobligated balance = allotments − obligations, % utilization = obligations ÷ allotments |
| BFARS 4 – LASA | `/bfars-reporting/bfars-4` (+ `/generate`) | FY / department / allotment class / quarter with Generate Report; five KPI cards (total allotments, sub-allotments, released, remaining balance, total records); LASA Details table with status badges, search and pagination; allotments-by-class donut, monthly allotments vs sub-allotments bars and top allottee offices; Export to Excel (.xlsx), Export to PDF (print dialog), Print. The generator has FY / quarter / department / UACS major / status, report options (cover, summary, group by allotment class, show sub-allotments, include status, signature page), output format (PDF/XLSX/XLS) and a live paged preview of BFARS Form 4 (Annex D) with summary by allotment class and by status. Data: `src/mocks/data/lasa.ts` (48 Q1 records; the first 10 follow the BFARS 4 sample workbook); balance = allotment − released |
| Allotment Classes › RAOCO/RAOFE | `/allotment-classes/raoco` · `raofe` | Per-class registry: totals, monthly trend, allotment utilisation, obligation entries |
| BFARS Reporting › BFARS 1–11 | `/bfars-reporting/bfars-1` … `bfars-11` | Report viewer per BFARS form with quarter filter, chart, totals, CSV export and print |
| Reports | `/reports` | Report catalogue by category, generate dialog, recently generated list |
| Settings › Profile | `/settings/profile` | Editable profile and change-password forms |
| Settings › Logout | — | Ends the session and returns to `/login` |

The sidebar collapses to icons on desktop (hamburger in the header) and becomes a drawer below 1024 px. Groups open automatically for the active route, and the parent stays highlighted while one of its pages is active.

> The menu label is **RAOPS** (as in the UI reference and the BFARS sample workbooks); the route keeps the requested `/allotment-classes/raop`.

BFARS report titles and columns follow the agency's FY 2026 Q1 sample workbooks. They are illustrative sample structures, not official report definitions; validate them before official use.

## GAA Upload workflow

GAA Upload is a single page (`/appropriations/gaa-upload`) that walks through four steps. The step, selected upload, column mapping and import settings live in the `gaaWizard` Redux slice, so leaving the page and coming back keeps your place. A `?batch=<id>` link resumes an existing upload.

1. **Upload File**: drag and drop or choose an Excel/CSV file (≤ 20 MB). The file is uploaded immediately; the page shows file details, a data preview with pagination, and the list of recent uploads to continue.
2. **Validate Data**: runs `POST /gaa/uploads/:id/validate` and shows totals, errors, warnings and duplicates, a filterable/searchable table with per-row remarks, a validation summary and a downloadable error report. Checks are format-level only (8-digit UACS code, required Fund Source and Description, known allotment class, amount > 0, fiscal year) plus a duplicate-row warning; business rules are left to the backend.
3. **Map & Configure**: maps each file column to an eBudget field (Auto Map / Reset Mapping), shows field details, import settings (fiscal year, create or update, data sheet, first data row, skip rows with errors, update existing records) and a preview of the mapped data.
4. **Import to System**: `POST /gaa/uploads/:id/import` creates (or updates) appropriations and shows per-row results (Imported, Updated, With Warning, Failed, Skipped) with a downloadable report, an error-log filter and Import Again.

## State management

**Redux Toolkit** holds client state only:

| Slice | State |
| --- | --- |
| `auth` | session status (`checking` / `authenticated` / `unauthenticated`) and the current user. Updated by RTK Query matchers on login, `GET /auth/me` and profile updates. No passwords or tokens. |
| `ui` | sidebar collapsed (desktop) and mobile drawer open |
| `filters` | header selections shared across modules: fiscal year and agency |
| `alerts` | toast notifications |
| `gaaWizard` | GAA Upload workflow step, selected upload, column mapping and import settings |

The store is created by `makeStore()` inside `StoreProvider` with `useState`, so every browser session (and every server render) gets its own store and nothing is shared between requests. Use the typed hooks from `src/store/hooks.ts`:

```ts
const fiscalYear = useAppSelector(selectFiscalYear);
const dispatch = useAppDispatch();
dispatch(fiscalYearChanged(2025));
```

Component-only state (open modals, form inputs, table filters) stays in `useState`.

## API layer

Request flow (identical in both modes):

```
page / component
  → RTK Query hook        src/features/<feature>/services/*Api.ts   (cache, loading/error state, tag invalidation)
  → service               src/services/<module>.service.ts          (one typed method per endpoint)
  → API client            src/lib/api/api-client.ts                 (config, auth, timeout, errors, normalisation)
  → mock API              src/mocks/mock-api.ts      when NEXT_PUBLIC_API_MODE=mock
    or fetch(baseUrl + path)                          when NEXT_PUBLIC_API_MODE=real
```

| File | Role |
| --- | --- |
| `src/config/api.config.ts` | Reads and validates the API environment variables |
| `src/lib/api/endpoints.ts` | Every backend path |
| `src/lib/api/api-client.ts` | `apiClient.get/post/put/patch/delete/upload/download`, query strings, JSON/FormData bodies, bearer token, timeouts, 401/403 events. Real mode never falls back to mock data |
| `src/lib/api/api-response.ts` | Unwraps `{ success, data, meta }` envelopes and Laravel paginators into the app's shapes (`Paginated<T>`) |
| `src/lib/api/api-error.ts` | `ApiRequestError` and normalisation of HTTP, network, timeout and invalid-JSON failures to `ApiError { status, code, message, fieldErrors? }` (5xx details are hidden) |
| `src/lib/api/auth-token.ts` | Optional bearer token storage and session events |
| `src/lib/api/client.ts` | RTK Query `baseQuery` and the `fromService()` helper used by every endpoint's `queryFn` |
| `src/services/*.service.ts` | Services: auth, settings/notifications, dashboard, appropriations + GAA, allotments + allotment classes, obligations, BFARS 1–11, reports |

- `src/store/services/api.ts` defines the single `createApi()` with tag types; each feature injects endpoints and exports hooks (`useGetObligationsQuery`, `useCreateAllotmentMutation`, …). Endpoints call services through `queryFn: (arg) => fromService(() => service.method(arg))`.
- Caching uses tags: e.g. creating an obligation invalidates `Obligation LIST`, `Obligation SUMMARY` and `Dashboard`, so the list, metrics and dashboard refresh automatically.
- `src/store/middleware/apiErrorListener.ts` handles errors centrally (401 ends the session; failed queries raise a toast). Forms map `fieldErrors` from 422 responses onto fields with `applyServerErrors`. `ErrorState` shows connection, access-denied and not-found errors with a retry button.
- BFARS generators record each generated report through `POST /bfars/{id}/generate`, so it appears under Reports › Recently Generated; generated reports can be downloaded from there.

## Authentication

- Forms use React Hook Form + Zod (`src/features/auth/schemas`).
- On login, the backend is expected to set an **httpOnly session cookie** named `ebudget_session` (see `src/lib/auth/session.ts`). The mock API imitates this with a non-sensitive placeholder cookie.
- `src/middleware.ts` redirects visitors without the cookie away from protected routes (`/login?next=…`) and signed-in visitors away from the auth pages.
- `AppShell` calls `GET /auth/me` to load the user; if it fails, the user is sent to login.
- Logout calls `POST /auth/logout`, resets the auth slice and the RTK Query cache, and redirects to `/login`.
- Redux auth state is for display only. Authorisation must be enforced by the backend.

### Testing the flows

1. Visit `/dashboard` while signed out: you are redirected to `/login?next=/dashboard`.
2. Sign in with a demo account: you return to the page you asked for.
3. Register at `/register`, then sign in with the new account.
4. Use **Forgot password**: in mock mode a reset link is shown on screen (no email is sent).
5. Settings › Logout or the user menu signs you out.

## Dummy data and mock services

- `src/mocks/mock-api.ts` answers requests with the same `{ success, data }` envelope and `{ success: false, message, errors }` errors as the backend contract, so both modes share one code path. In development, `__EBUDGET_MOCK__.failNext(500)` (or `failNext(0)` for a network error) in the browser console makes the next request fail; `NEXT_PUBLIC_MOCK_API_FAILURE_RATE` fails a share of requests at random.
- Seed data is in `src/mocks/data`. FY 2026 matches the dashboard reference (₱500M appropriations, ₱420M allotments, ₱310M obligations); FY 2025 and FY 2024 are scaled copies so the fiscal-year selector has data.
- `src/mocks/services/db.ts` keeps an in-memory database. Records created in the UI (appropriations, allotments, obligations, imports, generated reports, profile edits) persist until the page is fully reloaded (or across reloads with `NEXT_PUBLIC_MOCK_API_PERSIST=true`, stored in localStorage by `src/mocks/services/persistence.ts`).
- Handlers in `src/mocks/handlers` implement the same endpoints and response types the backend should provide, including validation errors (422), not found (404) and auth errors (401).
- GAA upload: CSV files that follow the template are parsed and validated in the browser. `.xlsx/.xls` uploads return the template's sample rows (put "error" in the file name to see validation failures) since spreadsheet parsing is a backend responsibility. The mock reads columns in template order; the column mapping is sent with the import request for the backend to apply.
- UI components never import mock data; they only use RTK Query hooks.

## Connecting the real backend

1. Implement the endpoints in [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md) (field notes in [docs/API.md](docs/API.md)) with the documented request/response types (the TypeScript types in `src/features/*/types` are the contract).
2. Set the session cookie `ebudget_session` (httpOnly, Secure, SameSite=Lax) on login and clear it on logout. If your cookie name differs, change `SESSION_COOKIE`.
3. Enable CORS with credentials for the frontend origin, or serve the API from the same origin.
4. Return errors as `{ "message": string, "errors"?: { [field]: string | string[] } }`. Responses may be plain objects or wrapped in `{ success, data, meta }`; adapt `src/lib/api/api-response.ts` if your format differs.
5. Set `NEXT_PUBLIC_API_MODE=real` and `NEXT_PUBLIC_API_BASE_URL` to the API URL, then restart or rebuild.

No page, component, slice or service changes are required. The `src/mocks` folder can be deleted once the backend is live.

## Expected API endpoints

See [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md) for parameters, payloads, validation, auth and errors. Summary:

| Method | Path |
| --- | --- |
| POST | `/auth/login`, `/auth/logout`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` |
| GET | `/auth/me` |
| GET / PATCH | `/profile` |
| POST | `/profile/change-password` |
| GET | `/dashboard/overview`, `/dashboard/recent-transactions` |
| GET / POST | `/appropriations` |
| GET | `/appropriations/summary`, `/appropriations/lookups` |
| POST | `/appropriations/documents` (multipart) |
| DELETE | `/appropriations/:id` |
| GET / POST | `/allotments` |
| GET | `/allotments/summary`, `/allotments/next-number`, `/allotments/:id` |
| POST | `/allotments/documents`, `/allotments/:id/documents` (multipart) |
| POST | `/allotments/:id/workflow`, `/allotments/registry` |
| PUT | `/allotments/:id/registry` |
| DELETE | `/allotments/:id/documents/:docId` |
| GET | `/allotment-classes/:code/lookups` |
| DELETE | `/allotments/:id` |
| GET / POST | `/gaa/uploads` (POST is multipart) |
| GET | `/gaa/uploads/:id`, `/gaa/uploads/:id/rows`, `/gaa/uploads/:id/columns` |
| POST | `/gaa/uploads/:id/validate` |
| GET / POST | `/gaa/uploads/:id/import` (GET returns the last import result) |
| DELETE | `/gaa/uploads/:id` |
| GET / POST | `/obligations` |
| GET | `/obligations/summary`, `/obligations/lookups`, `/obligations/next-number`, `/obligations/:id` |
| PUT / DELETE | `/obligations/:id` |
| POST | `/obligations/documents` (multipart), `/obligations/:id/workflow` |
| GET | `/allotment-classes/:code/registry` |
| GET | `/bfars/:id`, `/bfars/bfars-1/qpro` … `/bfars/bfars-11/sabudbtr`, `/bfars/:id/generated` |
| POST | `/bfars/:id/generate` |
| GET | `/reports/history/:id/download` |
| GET | `/reports`, `/reports/history` |
| POST | `/reports/generate` |
| GET | `/notifications` |
| PATCH | `/notifications/:id/read` |
| POST | `/notifications/read-all` |
