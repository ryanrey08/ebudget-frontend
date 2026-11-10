# eBudget API endpoint specification

**Status:** proposed contract for the future backend (e.g. Laravel). None of these routes exist on a server yet. The frontend's mock API (`src/mocks`) implements every route below, so the app works today without a backend, and the real backend only has to implement the same contract.

- Paths are relative to `NEXT_PUBLIC_API_BASE_URL` (e.g. `https://your-backend-domain.com/api`).
- The single source of paths is [`src/lib/api/endpoints.ts`](../src/lib/api/endpoints.ts). Request/response types live in `src/features/<feature>/types` and `src/types/api.ts`.
- [`docs/API.md`](API.md) has extra field-level notes per module (GAA template columns, BFARS row shapes, workflow rules).

---

## 1. Switching between mock and real mode

| Variable | Values | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_MODE` | `mock` (default) \| `real` | Where requests are answered |
| `NEXT_PUBLIC_API_BASE_URL` | URL, no trailing slash | Backend base URL (real mode) |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | number, default `30000` | Request timeout (real mode) |
| `NEXT_PUBLIC_API_WITH_CREDENTIALS` | `true` (default) \| `false` | Send cookies (session cookie) |
| `NEXT_PUBLIC_MOCK_API_DELAY_MS` | number, default `450` | Simulated latency (mock mode) |
| `NEXT_PUBLIC_MOCK_API_FAILURE_RATE` | `0`–`1`, default `0` | Share of mock requests that fail with 503 |
| `NEXT_PUBLIC_MOCK_API_PERSIST` | `true` \| `false` (default) | Keep mock changes in localStorage across reloads |

To connect a backend, set in `.env.local` and restart/rebuild:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com/api
NEXT_PUBLIC_API_MODE=real
```

Nothing else changes: pages → RTK Query hooks → `src/services/*.service.ts` → `src/lib/api/api-client.ts` → mock API **or** `fetch`. In real mode a failed request is shown as an error; the app never falls back to dummy data.

`NEXT_PUBLIC_*` values are public (they are compiled into the browser bundle). Never put API keys, database credentials or tokens in them.

---

## 2. Conventions

### 2.1 Requests

- JSON bodies with `Content-Type: application/json`; uploads use `multipart/form-data`.
- Headers sent by the client: `Accept: application/json`, `X-Requested-With: XMLHttpRequest`, and `Authorization: Bearer <token>` when a token is set (see §2.4).
- Query parameters with empty values are omitted. Arrays are sent as repeated keys (`status=A&status=B`).
- Amounts are numbers in PHP (no thousands separators). Dates are ISO 8601 (`2026-03-31` or `2026-03-31T08:00:00.000Z`).
- Most lists take `fiscalYear` (e.g. `2026`).

### 2.2 Successful responses

The client accepts any of these and normalizes them in `src/lib/api/api-response.ts` (adapt that file if the backend uses another format):

```jsonc
// Preferred envelope
{ "success": true, "message": "Optional", "data": { /* T */ } }

// Paginated list: envelope + Laravel pagination meta …
{ "success": true, "data": [ /* T[] */ ], "meta": { "current_page": 1, "last_page": 4, "per_page": 10, "total": 37 } }
// … or a Laravel resource collection / paginator (`{ data, links, meta }` or `{ data, current_page, per_page, total }`)
// … or the frontend shape directly
{ "items": [ /* T[] */ ], "total": 37, "page": 1, "pageSize": 10 }

// No content
HTTP 204
```

All of them reach the UI as `T` or `Paginated<T> = { items, total, page, pageSize }`. Lists take `page` (1-based) and `pageSize` (max 100).

### 2.3 Errors

```json
{ "success": false, "message": "Some fields are invalid.", "errors": { "amount": ["Amount exceeds the unallotted balance."] } }
```

`errors` values may be a string or an array (first entry is shown on the matching form field). The UI shows `message` for 4xx; for 5xx it shows a generic message so stack traces or SQL are never displayed. A response with `success: false` is treated as an error even with HTTP 200.

| Status | Code in the UI | When | UI behaviour |
| --- | --- | --- | --- |
| 400 / 422 | `VALIDATION` | Invalid input | Field errors on the form, form data kept |
| 401 / 419 | `UNAUTHORIZED` | Not signed in / session expired | Token cleared, session ended, back to login |
| 403 | `FORBIDDEN` | Signed in but not allowed (wrong role or workflow step) | "Access denied" message |
| 404 | `NOT_FOUND` | Unknown record or route | "Not found" message |
| 409 | `CONFLICT` | Business rule blocks the action (e.g. delete an appropriation with allotments) | Message shown |
| 429 | — | Rate limited | Message shown |
| 5xx | `SERVER_ERROR` | Server failure | Generic message + retry |
| — | `NETWORK_ERROR` | Backend unreachable / CORS | "Cannot connect to the server" + retry |
| — | `TIMEOUT` | No response within the timeout | Timeout message + retry |
| — | `INVALID_RESPONSE` | 2xx with a body that is not valid JSON | Message shown |

### 2.4 Authentication

- **Current contract:** the backend sets an httpOnly, Secure `ebudget_session` cookie on login and clears it on logout. The client sends `credentials: "include"`, so the backend must enable CORS with credentials for the frontend origin (or be served from the same origin). Next.js middleware only checks that the cookie exists (UX redirect); **the backend must authorise every request**.
- **Token alternative:** if login returns `{ "token": "…" }` in its data, the client stores it in memory/sessionStorage and sends `Authorization: Bearer <token>` (Laravel Sanctum style). No other change is needed.
- Every endpoint except those marked *Public* requires an authenticated user. Workflow actions additionally require the role for the current step (see each module).

Roles (`User.role`): `budget_officer`, `budget_head`, `accountant`, `head_of_agency`, `administrator`.

---

## 3. Authentication

| Method | Endpoint | Description | Payload / params | Response | Validation & errors | Auth |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/login` | Sign in | `LoginRequest { email, password, remember }` | `AuthResponse { user: User, expiresAt, token? }` + session cookie | 422 missing fields; 401 `Invalid email or password.` | Public |
| POST | `/auth/logout` | Sign out | — | `{ message }` + clears cookie | — | User |
| GET | `/auth/me` | Current user | — | `User` | 401 when not signed in | User |
| POST | `/auth/register` | Request an account | `RegisterRequest { firstName, lastName, email, employeeId, office, password }` | `{ message }` | 422 `email` already registered, weak password | Public |
| POST | `/auth/forgot-password` | Send reset link | `{ email }` | `{ message }` (always 200, no account enumeration) | 422 invalid email | Public |
| POST | `/auth/reset-password` | Reset password | `{ token, password }` | `{ message }` | 422 invalid/expired token | Public |

## 4. Settings (profile)

| Method | Endpoint | Description | Payload / params | Response | Validation & errors | Auth |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/profile` | Signed-in user's profile | — | `User` | 401 | User |
| PATCH | `/profile` | Update profile | `UpdateProfileRequest { firstName, lastName, email, phone, position, office }` | `User` | 422 required fields, email format/uniqueness | User |
| POST | `/profile/change-password` | Change password | `{ currentPassword, newPassword }` | `{ message }` | 422 `currentPassword` wrong, `newPassword` too weak | User |

## 5. Notifications

| Method | Endpoint | Description | Response | Errors | Auth |
| --- | --- | --- | --- | --- | --- |
| GET | `/notifications` | Notifications for the user, newest first | `AppNotification[]` | 401 | User |
| PATCH | `/notifications/{id}/read` | Mark one as read | `{ message }` | 404 | User (own) |
| POST | `/notifications/read-all` | Mark all as read | `{ message }` | — | User |

## 6. Dashboard

| Method | Endpoint | Description | Params | Response | Auth |
| --- | --- | --- | --- | --- | --- |
| GET | `/dashboard/overview` | Summary cards and charts | `fiscalYear` | `DashboardOverview { summary: { totalAppropriations, totalAllotments, totalObligations, totalDisbursements, availableBalance }, utilization[] (per allotment class: appropriations, allotments, obligations), allocation[] (per class: amount) }` | User |
| GET | `/dashboard/recent-transactions` | Latest appropriations/allotments/obligations/disbursements | `fiscalYear`, `limit` (default 6) | `Transaction[] { id, date, referenceNo, type, description, amount, status }` | User |

Rules implemented by the mock (keep them in the backend): allotments exclude `Draft`/`Rejected`; obligations exclude `Draft`/`Cancelled`; `availableBalance = totalAllotments − totalObligations`; disbursements are the sum of `Obligation.disbursed`. Pending approvals are shown through notifications and the obligation/allotment tabs.

## 7. Appropriations

| Method | Endpoint | Description | Params / payload | Response | Validation & errors | Auth |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/appropriations` | List / search / filter | `fiscalYear, page, pageSize, search, allotmentClass, status, fundSource, program, category` | `Paginated<Appropriation>` | — | User |
| GET | `/appropriations/summary` | Totals and balances | `fiscalYear` | `AppropriationSummary { totalAmount, count, released, unreleased, byClass[], byFundSource[], byCategory }` | — | User |
| GET | `/appropriations/lookups` | Form options | — | `AppropriationLookups { offices, programs, fundSources, levels, uacsCodes }` | — | User |
| GET | `/appropriations/{id}` | Details *(reserved; the UI currently opens details from the list record)* | — | `Appropriation` | 404 | User |
| POST | `/appropriations/documents` | Upload a supporting document | `multipart/form-data`: `file` (PDF/Excel/JPG/PNG, ≤ 10 MB) | `AppropriationDocument { id, name, size, mimeType, uploadedAt }` | 400 no file; 413 too large; 422 type | Budget officer+ |
| POST | `/appropriations` | Create (or save draft) | `CreateAppropriationRequest` (incl. `documentIds`, `draft`) | `Appropriation` (`status` `Draft` or `Unreleased`, `referenceNo` `APP-{FY}-###`) | 422 field errors; drafts only need `title` | Budget officer+ |
| DELETE | `/appropriations/{id}` | Delete | — | `{ message }` | 404; 409 if allotments exist | Budget officer+ |

Balances: `allotted` = sum of linked allotments (not Draft/Rejected), `released` = sum of their releases; status is `Unreleased` (nothing released), `Active` (partly) or `Released` (fully).

## 8. GAA Upload (Upload → Validate → Map & Configure → Import)

| Method | Endpoint | Description | Params / payload | Response | Validation & errors | Auth |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/gaa/uploads` | Upload history | — | `GaaUploadBatch[]` | — | User |
| POST | `/gaa/uploads` | Upload a GAA file | `multipart/form-data`: `file` (.xlsx/.xls/.csv, ≤ 20 MB), `fiscalYear` | `GaaUploadBatch` (`Uploaded`) | 400 no file; 413; 422 type/fiscal year/unreadable file | Budget officer+ |
| GET | `/gaa/uploads/{id}` | One batch | — | `GaaUploadBatch` | 404 | User |
| GET | `/gaa/uploads/{id}/rows` | Parsed rows with issues | — | `GaaRow[]` (`errors[]`, `warnings[]`) | 404 | User |
| GET | `/gaa/uploads/{id}/columns` | Columns found in the file | — | `GaaSourceColumn[] { key, header, sample }` | 404 | User |
| POST | `/gaa/uploads/{id}/validate` | Validate rows | — | `GaaValidationSummary { total, valid, errors, warnings, duplicates, topErrors, topWarnings }` | 404 | Budget officer+ |
| POST | `/gaa/uploads/{id}/import` | Import into appropriations | `{ mapping: GaaMapping, settings: GaaImportSettings }` | `ImportGaaResponse { total, importedCount, failedCount, warningCount, skippedCount, totalAmount, results[] }` | 422 required fields unmapped; 409 already imported | Budget officer+ |
| GET | `/gaa/uploads/{id}/import` | Last import result | — | `ImportGaaResponse` | 404 if not imported | User |
| DELETE | `/gaa/uploads/{id}` | Delete a batch | — | `{ message }` | 409 if imported | Budget officer+ |

## 9. Allotments

| Method | Endpoint | Description | Params / payload | Response | Validation & errors | Auth |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/allotments` | List / search / filter | `fiscalYear, page, pageSize, search, allotmentClass, fundSource, program, status, group` | `Paginated<Allotment>` | — | User |
| GET | `/allotments/summary` | Totals | `fiscalYear` | `AllotmentSummary { totalAllotments, totalReleased, unreleased, count, byGroup, byClass, monthly }` | — | User |
| GET | `/allotments/next-number` | Next allotment number | `fiscalYear` | `{ allotmentNo }` | — | User |
| GET | `/allotments/{id}` | Details + parent appropriation balance | — | `AllotmentDetail { allotment, appropriation: { amount, totalAllotted, remaining } }` | 404 | User |
| POST | `/allotments` | Create (or draft) | `CreateAllotmentRequest` (`appropriationRef`, amount, tranche, release, `documentIds`, `draft`) | `Allotment` | 422 amount exceeds unallotted balance, release exceeds amount, required fields | Budget officer+ |
| POST | `/allotments/documents` | Upload a document before saving | `multipart/form-data`: `file`, `category?`, `description?` | `AllotmentDocument` | 400/413/422 | Budget officer+ |
| POST | `/allotments/{id}/documents` | Attach a document | `multipart/form-data`: `file` | `AllotmentDetail` | 404/413/422 | Budget officer+ |
| DELETE | `/allotments/{id}/documents/{docId}` | Remove a document | — | `AllotmentDetail` | 404; 409 when not editable | Budget officer+ |
| POST | `/allotments/{id}/workflow` | Approval action | `{ action: "submit" \| "approve" \| "return" \| "reject" \| "saveRemarks", remarks?, releaseDate?, mdsReferenceNo?, signature?, submission? }` | `AllotmentDetail` | 422 remarks required for return/reject, MDS no. for release; 403 wrong role/step; 409 invalid status | Role of the current step |
| DELETE | `/allotments/{id}` | Delete | — | `{ message }` | 409 unless Draft/Returned | Budget officer+ |

Workflow: `prepared → review (Budget Head) → accountant → certification (Head of Agency) → release`. Statuses: `Draft`, `For Approval`, `Unreleased`, `Partial`, `Released`, `Returned`, `Rejected`.

## 10. Allotment classes (RAOPS, RAOMO, RAOCO, RAOFE)

`{code}` is `RAOPS`, `RAOMO`, `RAOCO` or `RAOFE` (menu label RAOPS, route `/allotment-classes/raop`).

| Method | Endpoint | Description | Params / payload | Response | Validation & errors | Auth |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/allotment-classes/{code}/registry` | Registry page data (records, totals, charts) | `fiscalYear` | `AllotmentClassRegistry` | 404 unknown class | User |
| GET | `/allotment-classes/{code}/lookups` | Form options | — | `RegistryLookups { departments, documentCategories, requiredDocuments, priorities, approvers, lineCategories? }` | 404 | User |
| POST | `/allotments/registry` | Create a registry allotment (Draft) | `RegistryAllotmentInput` | `Allotment` (`workflowType: "registry"`) | 422 line items exceed total allotment (RAOCO), required fields | Budget officer+ |
| PUT | `/allotments/{id}/registry` | Update a registry allotment | `RegistryAllotmentInput` | `Allotment` | 409 unless Draft/Returned; 422 | Budget officer+ |

Registry workflow: `prepared → submit → review (Budget Head) → accountant → certification (Head of Agency)`; it uses `/allotments/{id}/workflow`.

## 11. Obligation management

| Method | Endpoint | Description | Params / payload | Response | Validation & errors | Auth |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/obligations` | List / search / filter | `fiscalYear, page, pageSize, search, tab, status, allotmentClass, fundSource, dateFrom, dateTo` | `Paginated<Obligation>` | — | User |
| GET | `/obligations/summary` | Totals | `fiscalYear` | `ObligationSummary { totalObligations, obligatedAmount, pendingApproval, releasedAmount, byTab, byClass, monthly }` | — | User |
| GET | `/obligations/lookups` | Form options (units, payees, source allotments…) | — | `ObligationLookups` | — | User |
| GET | `/obligations/next-number` | Next reference number | `fiscalYear` | `{ referenceNo }` | — | User |
| GET | `/obligations/{id}` | Details, documents and approval history (`obligation.workflow`) | — | `ObligationDetail { obligation, allotment: { amount, otherObligations, remaining } }` | 404 | User |
| POST | `/obligations` | Create request (Draft) | `ObligationInput` (allotmentRef, payee, line items, references, `documentIds`) | `Obligation` | 422 required fields, line items, amount exceeds allotment balance | Budget officer+ |
| PUT | `/obligations/{id}` | Update a draft/returned request | `ObligationInput` | `Obligation` | 409 unless Draft/Returned; 422 | Budget officer+ |
| POST | `/obligations/documents` | Upload a supporting document | `multipart/form-data`: `file` | `ObligationDocument` | 400/413/422 | Budget officer+ |
| POST | `/obligations/{id}/workflow` | Submit / approve / back / return / reject / saveRemarks | `{ action, remarks?, signature? }` | `ObligationDetail` | 422 remarks/signature required; 403 wrong role/step; 409 invalid status | Role of the current step |
| DELETE | `/obligations/{id}` | Delete | — | `{ message }` | 409 unless Draft/Returned | Budget officer+ |

Workflow: `encode → submit → review (Budget Head) → accountant → certification (Head of Agency) → release`. Statuses: `Draft`, `For Approval`, `Approved`, `Released`, `Returned`, `Cancelled`.

## 12. BFARS reporting (BFARS 1–11)

Each report has a data endpoint (filters → rows + filter `options`), a generate endpoint and a generated-history endpoint. The preview, print and PDF/Excel/Word files are built in the browser from the data endpoint by each report's `document.ts`, using the formulas documented in `docs/bfars-N-implementation.md`; the backend only supplies the records.

`Quarter` is `Q1`–`Q4`. Empty filter values mean "all". All endpoints require an authenticated user.

| # | Report | Data endpoint (GET) | Params | Response |
| --- | --- | --- | --- | --- |
| 1 | QPRO – Quarterly Physical Report of Operations | `/bfars/bfars-1/qpro` | `fiscalYear, quarter, department, uacsMajor, allotmentClass, pap, fundSource, status` | `QproReport { rows, previousCount, options, period, asOf }` |
| 2 | SAAODB | `/bfars/bfars-2/saaodb` | `fiscalYear, quarter, department, uacsMajor, allotmentClass` | `SaaodbReport { rows, signatories, options, period, asOf, fundSource }` |
| 3 | SAAODBOE | `/bfars/bfars-3/saaodboe` | same as BFARS 2 | `SaaodboeReport { rows, remarks, signatories, options, … }` |
| 4 | LASA | `/bfars/bfars-4/lasa` | `fiscalYear, quarter, department, allotmentClass, uacsMajor, status` | `LasaReport { rows, appropriations, signatories, options, … }` |
| 5 | SODLBIAFT | `/bfars/bfars-5/sodlbiaft` | `fiscalYear, quarter, office, sourceAgency, program` | `SodlbiaftReport { rows, signatories, options, period, asOf, agency, fundSource }` |
| 6 | SABUDB | `/bfars/bfars-6/sabudb` | same as BFARS 2 | `SabudbReport { rows, previous, signatories, options, … }` |
| 7 | SABUDBOE | `/bfars/bfars-7/sabudboe` | same as BFARS 2 | `SabudboeReport { rows, previous, signatories, options, … }` |
| 8 | AUO – Aging of Unpaid Obligations | `/bfars/bfars-8/auo` | `fiscalYear, asOf (ISO date), department, allotmentClass, uacsMajor` | `AuoReport { rows, signatories, options, period, asOf }` |
| 9 | MRD – Monthly Report of Disbursement | `/bfars/bfars-9/mrd` | `fiscalYear, month (1–12), department, allotmentClass, uacsMajor` | `MrdReport { rows, signatories, options, period, month }` |
| 10 | QRROR | `/bfars/bfars-10/qrror` | `fiscalYear, quarter, department, classification, uacsMajor` | `QrrorReport { rows, previousQuarter, previousYear, signatories, options, … }` |
| 11 | SABUDBTR | `/bfars/bfars-11/sabudbtr` | `fiscalYear, quarter, department, fund, uacsMajor` | `SabudbtrReport { rows, previousQuarter, signatories, options, … }` |

Common BFARS endpoints (`{id}` = `bfars-1` … `bfars-11`):

| Method | Endpoint | Description | Payload | Response | Validation & errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/bfars/{id}/generate` | Record a generated report in the history | `{ params: <report params>, format: "pdf" \| "excel" \| "xlsx" \| "xls" \| "word" \| "csv", options?: { … generator options } }` | `GeneratedReport { id, reportId: "rpt-{id}", reportName, period, format: "PDF" \| "XLSX" \| "DOCX" \| "CSV", generatedAt, generatedBy, status, parameters }` | 404 unknown report; 422 missing `params` or `format` |
| GET | `/bfars/{id}/generated` | Previously generated copies, newest first | — | `GeneratedReport[]` | 404 |
| GET | `/bfars/{id}` | Generic column-driven report (fallback viewer) | `fiscalYear, quarter` | `BfarsReportData { columns, rows, totals?, metrics, chart?, notes, period, agency }` | 404 |

Field-level descriptions of each report's rows are in [`docs/API.md`](API.md#bfars-reports) and the `docs/bfars-N-implementation.md` notes.

Service methods: `bfarsService.getBFARS1(params)`, `bfarsService.generateBFARS1(payload)`, `bfarsService.getGeneratedBFARS1()`, … through `BFARS11` (`src/services/bfars.service.ts`).

## 13. Reports

| Method | Endpoint | Description | Params / payload | Response | Validation & errors | Auth |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/reports` | Report catalog | `category` (`Budget`, `Allotment`, `Obligation`, `BFARS`, `Disbursement`), `search` | `ReportDefinition[]` (with `lastGeneratedAt`) | — | User |
| GET | `/reports/history` | Generated report history | — | `GeneratedReport[]` | — | User |
| POST | `/reports/generate` | Generate a catalog report | `{ reportId, period, format: "PDF" \| "XLSX" \| "CSV" }` | `GeneratedReport` | 404 unknown report; 422 period/format | User |
| GET | `/reports/history/{id}/download` | Download a generated file | — | File stream with `Content-Disposition: attachment; filename="…"` | 404; 409 while `Processing` | User |

## 14. Modules not present in the frontend yet

The sidebar has no **User Management** or **Role & Permission Management** pages, so no endpoints are used for them. Roles exist only as `User.role` (see §2.4). When those pages are built, suggested routes are `GET/POST /users`, `GET/PUT/DELETE /users/{id}`, `PATCH /users/{id}/status`, `GET/POST /roles`, `GET/PUT/DELETE /roles/{id}`, `GET /permissions`, `PUT /roles/{id}/permissions`, following the conventions above.
