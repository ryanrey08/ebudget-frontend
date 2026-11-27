# Frontend API integration audit

Every route of `ebudget-frontend` mapped to the backend endpoint it uses, against `backend-api`
`main` at `ea276fd` (see [BACKEND_API_CHANGE_AUDIT.md](BACKEND_API_CHANGE_AUDIT.md)). Updated
2026-11-26.

**Status values:** Integrated · Partially integrated · Not integrated · Requires backend
clarification · Cannot be runtime-tested. "Demo data" means the backend has no endpoint for the
module: in real mode those requests are answered by the built-in demo API (`DEMO_ONLY_PATHS` in
`src/config/api.config.ts`) and the page shows a "Demo data" notice.

**Runtime testing:** every backend row marked "Integrated" was verified live on the local backend on
2026-11-27 (see API_DOCUMENTATION_AUDIT.md, "Live verification"). Not run live: fiscal-year **lock**
(permanent) and a successful password change (it would change your password).

## Authentication and session

| Route / feature | Backend endpoint | Status | Notes |
|---|---|---|---|
| `/login` | `POST /auth/login` via `/api/auth/login` | Integrated | Unchanged. Token in httpOnly `ebudget_session` cookie |
| Session check (AppShell) | `GET /auth/me` via `/api/auth/me` | Integrated | `permissions` now include the eBudget catalog; drives menu and actions |
| Logout (sidebar, user menu) | `POST /auth/logout` via `/api/auth/logout` | Integrated | Unchanged contract |
| Expired / revoked token | any 401 | Integrated | Data proxy and auth routes clear the cookie; client logs out and shows "Session expired" |
| 403 / problem codes | any 403 / 409 | Integrated | `ApiError.problemCode` keeps the backend `code`; messages come from `detail` |
| `/register`, `/forgot-password`, `/reset-password` | none | Not integrated (no backend endpoints) | Mock auth only; in real auth mode the backend has no such routes. Users are created by an administrator |
| Token refresh | none | Not integrated (not supported) | Tokens live 12 h; the user signs in again |

## Data access (all backend modules)

| Feature | Backend | Status | Notes |
|---|---|---|---|
| Data proxy `/api/v1/[...path]` | `/api/v1/{system}/*` | Integrated | Adds the bearer token from the cookie; passes JSON, multipart and downloads; rewrites `Location`; CSRF checks like the auth proxy |
| Mode switch | `NEXT_PUBLIC_API_MODE` | Integrated | `real`: backend modules hit the proxy; demo modules stay on demo data (`NEXT_PUBLIC_API_DEMO_MODULES`, default true). `mock`: backend-only pages show "needs the backend" |
| Header fiscal year | `GET /master-data/fiscal-years` | Integrated | Real mode lists the backend's years; pages resolve the year to `fiscal_year_id` |

## Appropriations

| Route | Backend endpoint(s) | Status | Notes |
|---|---|---|---|
| `/appropriations/appropriations` | `GET /appropriations` (filters, `search`, `page`, `per_page`, `meta.total_amount`), `DELETE /appropriations/{id}`, master-data lists for filters | Integrated | Rewritten on the line contract. Replaced the demo categories/status tabs, "Released/Unreleased" cards and charts (no backend source); shows total, count and fiscal-year status instead |
| `/appropriations/appropriations/new` | `POST /appropriations`, master-data lookups (active only, PAP `is_parent_only=0`) | Integrated | Field rules mirror `AppropriationLineRules`; 422 field errors shown per field |
| `/appropriations/appropriations/{id}/edit` | `GET`, `PATCH /appropriations/{id}` | Integrated | New route. Sends only changed fields; disables FY/org/codes on allotted lines (409 `appropriation_allotted`) |
| Line detail modal | list row data | Integrated | Shows allotted/unallotted and links the allotment |
| `/appropriations/gaa-upload` step 1 Upload | `POST /appropriations/import/validate` (multipart `file`) | Integrated | Rewritten. 422 `file` messages listed; template `public/templates/ebudget-gaa-upload-template.xlsx` is byte-identical to the backend's fixture |
| step 2 Validate | report `lines[].cells`, `errors[]` | Integrated | Cells editable; rows can be left out |
| step 3 Configure | `POST /appropriations/imports` | Integrated | Level, legal reference, title, dates, source name. 422 `lines.{i}.cells.{field}` mapped back to rows |
| step 4 Import | `GET /appropriations/imports/{id}` (polled 2 s) | Integrated | Completed → link to appropriations (cache invalidated); failed → errors can be sent back to step 2. Needs the backend's `imports` queue worker |
| Export to CSV / print, column picker (old page) | none | Removed with the old page | The backend has no export endpoint; can be re-added client-side if wanted |

## Allotments

| Route | Backend endpoint(s) | Status | Notes |
|---|---|---|---|
| `/appropriations/allotments` | `GET /allotments` (`fiscal_year_id`, `status`, `organization_id`, `search`, pagination, `meta.total_amount`) | Integrated | Rewritten. Released/pending cards cover the visible page (the list has no global totals for them) |
| `/appropriations/allotments/new` | `GET /appropriations?has_balance=1`, `POST /allotments`, `POST /allotments/{id}/releases`, `POST …/submit`, `GET /system-administration/approval-workflows?module=allotment&is_active=1` | Integrated | Create with the 1st tranche, or add the next tranche when the line already has an allotment. "Submit for approval" = save then submit |
| `/appropriations/allotments/{id}` | `GET/PATCH/DELETE /allotments/{id}`, `POST /cancel`, release add/edit/delete/submit/cancel, attachments upload/download/delete | Integrated | Rewritten. Totals and next tranche come from the backend; actions follow the status tables in the backend docs |
| Approval of a pending tranche | `GET /approval-requests/{id}`, approve/reject | Integrated | Embedded panel; full page at `/approvals/{id}` |

## Approvals

| Route | Backend endpoint(s) | Status | Notes |
|---|---|---|---|
| `/approvals/{requestId}` | `GET /approval-requests/{id}`, `POST …/steps/{step}/approve` (multipart `signature`, `remarks`), `POST …/reject`, `GET …/signature` | Integrated | New. Signature pad (draw or upload PNG/JPEG ≤ 1 MB) only when the step has a signatory |
| "My pending approvals" inbox | none | Requires backend clarification | The backend has no list of approval requests (or of steps awaiting a user). Requests are reached from their record |

## Master data (new pages, permission-gated in the sidebar)

| Route | Backend endpoint(s) | Status |
|---|---|---|
| `/master-data/fiscal-years` | CRUD + `close` / `reopen` / `lock` | Integrated |
| `/master-data/organizations` | CRUD, `search`, `is_active` | Integrated |
| `/master-data/prexc-items` | CRUD, `search`, `is_active`, `is_parent_only`, parent picker | Integrated (flat list with indentation; parent picker limited to the first 100 items) |
| `/master-data/uacs-objects` | CRUD, `search`, `is_active` | Integrated |
| `/master-data/fund-sources` | CRUD, `search`, `is_active` | Integrated |
| `/master-data/allotment-classes` | CRUD, `registry_code`, `search`, `is_active` | Integrated |

## Administration (new pages)

| Route | Backend endpoint(s) | Status | Notes |
|---|---|---|---|
| `/administration/users` | `GET/POST /users`, `PUT /users/{id}/roles`, `POST /users/{id}/(de)activate` | Integrated | One-time password shown once. The backend list has no search; the filter applies to the current page |
| `/administration/roles` | `GET /permissions`, `GET/POST/PATCH/DELETE /roles` | Integrated | Permission checklist grouped by module; built-in roles read-only |
| `/administration/signatories` | CRUD `/system-administration/signatories` | Integrated | User picker = first 100 users |
| `/administration/approval-workflows` | CRUD `/system-administration/approval-workflows` | Integrated | Step editor (order, user, signatory of that user) |
| `/administration/agency-profile` | `GET/PATCH /agency-profile`, `GET/POST/DELETE /agency-profile/logo` | Integrated | Logo shown through a blob URL |

## Settings

| Route | Backend endpoint(s) | Status | Notes |
|---|---|---|---|
| `/settings/profile` account card | `GET /auth/me` | Integrated | Roles and effective permissions |
| Change password | `PUT /auth/password` via `/api/auth/password` | Integrated | Backend rule (12+ chars, upper/lower, number, symbol) checked in the form; backend field errors mapped back |
| Edit name/email/phone | none | Not integrated (no backend endpoint) | Mock auth only; in real mode an administrator manages them |

## Modules the backend has no endpoints for (demo data)

| Route(s) | Demo endpoints | Status | What the backend would need |
|---|---|---|---|
| `/dashboard` | `/dashboard/overview`, `/dashboard/recent-transactions` | Not integrated (demo data) | Summary endpoint(s); totals could later come from `meta.total_amount` of appropriations/allotments |
| `/obligation-management` (+ `/new`, `/{id}`, `/{id}/edit`) | `/obligations/*` | Not integrated (demo data) | Obligation requests API. The approval module `obligation_request` already exists in workflows |
| `/allotment-classes/raop`, `/raomo`, `/raoco`, `/raofe` (+ `new`, `{id}`, `edit`), `/allotment-classes/[classSlug]` | `/allotment-classes/{code}/registry`, `/allotments/registry` | Not integrated (demo data) | RAO registry (obligations per allotment class). The classes themselves are now real under Master Data |
| `/bfars-reporting/bfars-1` … `bfars-11` (+ `/generate`), `/bfars-reporting/[reportId]` | `/bfars/*` | Not integrated (demo data) | Report data endpoints |
| `/reports` catalog and history | `/reports`, `/reports/history`, `/reports/generate` | Partially integrated | Catalog/history are demo data; the new "Report datasets" card uses the real `/reports/datasets` and `/reports/shares` |
| Header notifications | `/notifications/*` | Not integrated (demo data) | Notifications API |

## Replaced or removed frontend code

- Old demo-contract UIs for appropriations, GAA batches (column mapping, per-row statuses) and the
  allotment workflow pages were replaced by the backend contract. Their demo services
  (`appropriationsService`, `gaaService`, `allotmentsService` CRUD) remain only because the demo
  dashboard, obligations, registries and their tests use the same demo database; no page calls their
  `/appropriations`, `/gaa/*` or `/allotments` CRUD paths any more.
- Deleted components: `AppropriationsView`, `NewAppropriationView`, `AppropriationDetailModal`,
  `AppropriationStatusBadge`, `AppropriationSummaryCharts`, GAA `UploadStep`/`ValidateStep`/
  `MapConfigureStep`/`ImportResultStep`/`gaaColumns`, `gaaApi`, `AllotmentsView`,
  `NewAllotmentView`, `AllotmentDetailView`, `WorkflowPanels`, `AllotmentCharts`,
  `AllotmentStatusBadge`, appropriation and allotment form schemas.

## Runtime verification

See the "Runtime verification" section of [API_INTEGRATION.md](API_INTEGRATION.md#runtime-verification)
for what was exercised against the live backend and what could not be.
