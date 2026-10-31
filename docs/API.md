# eBudget API contract

All paths are relative to `NEXT_PUBLIC_API_BASE_URL`. Requests and responses are JSON unless noted. Authentication uses the `ebudget_session` httpOnly cookie, so the frontend sends `credentials: "include"` on every request.

TypeScript types referenced below live in `src/features/<feature>/types` and `src/types/api.ts`.

## Conventions

- **Paginated lists** take `page` (1-based) and `pageSize` and return `Paginated<T>`: `{ items: T[], total, page, pageSize }`.
- **Fiscal year**: most queries take `fiscalYear` (e.g. `2026`).
- **Errors** return an HTTP status and `{ "message": string, "errors"?: { [field]: string | string[] } }`. 401 ends the session in the UI; 422 field errors are shown on the matching form fields.
- **Amounts** are numbers in PHP. **Dates** are ISO 8601 strings.

## Authentication

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/login` | `LoginRequest { email, password, remember }` | `AuthResponse { user: User, expiresAt }` + sets session cookie |
| POST | `/auth/logout` | — | `{ message }` + clears cookie |
| GET | `/auth/me` | — | `User` (401 when not signed in) |
| POST | `/auth/register` | `RegisterRequest { firstName, lastName, email, employeeId, office, password }` | `{ message }` |
| POST | `/auth/forgot-password` | `{ email }` | `{ message }` (always 200) |
| POST | `/auth/reset-password` | `{ token, password }` | `{ message }` |

## Profile

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/profile` | — | `User` |
| PATCH | `/profile` | `{ firstName, lastName, email, phone, position, office }` | `User` |
| POST | `/profile/change-password` | `{ currentPassword, newPassword }` | `{ message }` (422 if current password is wrong) |

## Dashboard

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| GET | `/dashboard/overview` | `fiscalYear` | `DashboardOverview { summary, utilization[], allocation[] }` |
| GET | `/dashboard/recent-transactions` | `fiscalYear`, `limit` | `Transaction[]` |

## Appropriations and allotments

| Method | Path | Query / Body | Response |
| --- | --- | --- | --- |
| GET | `/appropriations` | `fiscalYear, page, pageSize, search, allotmentClass, status, fundSource, program, category` | `Paginated<Appropriation>` |
| GET | `/appropriations/summary` | `fiscalYear` | `AppropriationSummary { totalAmount, count, released, unreleased, byClass, byFundSource, byCategory }` |
| GET | `/appropriations/lookups` | — | `AppropriationLookups { offices, programs, fundSources, levels, uacsCodes }` |
| POST | `/appropriations/documents` | `multipart/form-data`: `file` (PDF/Excel/JPG/PNG, ≤10 MB) | `AppropriationDocument` |
| POST | `/appropriations` | `CreateAppropriationRequest` (includes `documentIds` and `draft`) | `Appropriation` (422 with field errors; drafts only need a title) |
| DELETE | `/appropriations/:id` | — | `{ message }` (409 if allotments exist) |
| GET | `/allotments` | `fiscalYear, page, pageSize, search, allotmentClass, fundSource, program, status, group` | `Paginated<Allotment>` |
| GET | `/allotments/summary` | `fiscalYear` | `AllotmentSummary { totalAllotments, totalReleased, unreleased, count, byGroup, byClass, monthly }` |
| GET | `/allotments/next-number` | `fiscalYear` | `{ allotmentNo }` |
| GET | `/allotments/:id` | — | `AllotmentDetail { allotment, appropriation: { amount, totalAllotted, remaining } }` |
| POST | `/allotments` | `CreateAllotmentRequest` (`documentIds`, `draft`) | `Allotment` (422 if amount exceeds the unallotted balance or release exceeds amount) |
| POST | `/allotments/documents` | `multipart/form-data`: `file`, optional `category`, `description` | `AllotmentDocument` |
| POST | `/allotments/:id/documents` | `multipart/form-data`: `file` | `AllotmentDetail` |
| POST | `/allotments/:id/workflow` | `{ action: "submit" \| "approve" \| "return" \| "reject", remarks?, releaseDate?, mdsReferenceNo? }` | `AllotmentDetail` |
| DELETE | `/allotments/:id` | — | `{ message }` (drafts/returned only) |

### Allotment-class (registry) allotments

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/allotment-classes/:code/lookups` | — | `RegistryLookups { departments, documentCategories, requiredDocuments, priorities, approvers, lineCategories? }` (`lineCategories` for RAOFE) |
| POST | `/allotments/registry` | `RegistryAllotmentInput` (reference appropriation, tranche, date, GAA reference no., department, fund source, UACS, line items, `documentIds`; optional `amount` (total allotment, RAOCO; line items may total less but not more), `requiredDocuments`, effectivity/validity dates) | `Allotment` (`workflowType: "registry"`, saved as Draft) |
| PUT | `/allotments/:id/registry` | `RegistryAllotmentInput` | `Allotment` (drafts and returned only) |
| DELETE | `/allotments/:id/documents/:docId` | — | `AllotmentDetail` |

Registry workflow: `prepared (Encode) → submit → review (Budget Head) → accountant → certification (Head of Agency)`. `submit` takes `submission { nextApprover, targetDate, priority }` and an optional message; approver steps need remarks; accountant and certification approvals need a `signature`. Certification completes the workflow and releases the allotment amount. `saveRemarks` stores draft remarks without acting.

Allotment workflow steps: `prepared → review (Budget Head) → accountant → certification (Head of Agency) → release`. Statuses: `Draft`, `For Approval`, `Unreleased` (certified, awaiting release), `Partial`, `Released`, `Returned`, `Rejected`. Return and reject require remarks; the release step requires an MDS reference number. The backend must enforce who may act on each step.

## GAA upload and import

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/gaa/uploads` | — | `GaaUploadBatch[]` |
| POST | `/gaa/uploads` | `multipart/form-data`: `file` (.xlsx/.xls/.csv, ≤20 MB), `fiscalYear` | `GaaUploadBatch` (status `Uploaded`; rows parsed, not yet validated) |
| GET | `/gaa/uploads/:id` | — | `GaaUploadBatch` |
| GET | `/gaa/uploads/:id/rows` | — | `GaaRow[]` (each with `errors: string[]` and `warnings: string[]`) |
| GET | `/gaa/uploads/:id/columns` | — | `GaaSourceColumn[] { key, header, sample }` — columns found in the file |
| POST | `/gaa/uploads/:id/validate` | — | `GaaValidationSummary { total, valid, errors, warnings, duplicates, topErrors, topWarnings }`; updates row issues and batch status (`Validated` / `With Errors`) |
| POST | `/gaa/uploads/:id/import` | `{ mapping: GaaMapping, settings: GaaImportSettings }` | `ImportGaaResponse { total, importedCount, failedCount, warningCount, skippedCount, totalAmount, results[] }` |
| GET | `/gaa/uploads/:id/import` | — | Last `ImportGaaResponse` (404 if not imported) |
| DELETE | `/gaa/uploads/:id` | — | `{ message }` (409 if already imported) |

`GaaMapping` maps each eBudget field (`office`, `uacsObjectCode`, `description`, `amount`, `fundSource`, `allotmentClass`, …) to a file column key (`"A"`, `"B"`, …). `GaaImportSettings` is `{ fiscalYear, importType: "create" | "update", dataSheet, firstDataRow, skipRowsWithErrors, updateExisting }`. Per-row result statuses are `Imported`, `Updated`, `With Warning`, `Failed` and `Skipped`.

The upload template columns are: Fiscal Year, Org Code, Organization / Office, UACS Object Code, Object of Expenditure / Description, Appropriation Amount (PHP), Fund Source, Allotment Class, Program / Activity / Project, PAP / UACS Code, Appropriation Type, Remarks (see `public/templates`).

## Obligations

| Method | Path | Query / Body | Response |
| --- | --- | --- | --- |
| GET | `/obligations` | `fiscalYear, page, pageSize, search, tab, status, allotmentClass, fundSource, dateFrom, dateTo` | `Paginated<Obligation>` |
| GET | `/obligations/summary` | `fiscalYear` | `ObligationSummary { totalObligations, obligatedAmount, pendingApproval, releasedAmount, byTab, byClass, monthly }` |
| GET | `/obligations/lookups` | — | `ObligationLookups { units, modesOfProcurement, applicableDocuments, payees, sources }` |
| GET | `/obligations/next-number` | `fiscalYear` | `{ referenceNo }` |
| GET | `/obligations/:id` | — | `ObligationDetail { obligation, allotment: { amount, otherObligations, remaining } }` |
| POST | `/obligations` | `ObligationInput` (line items, references, `documentIds`) | `Obligation` (saved as Draft; next step is Submit for Approval) |
| PUT | `/obligations/:id` | `ObligationInput` | `Obligation` (drafts and returned only) |
| POST | `/obligations/documents` | `multipart/form-data`: `file` | `ObligationDocument` |
| POST | `/obligations/:id/workflow` | `{ action: "submit" \| "approve" \| "back" \| "return" \| "reject" \| "saveRemarks", remarks?, signature? }` | `ObligationDetail` |
| DELETE | `/obligations/:id` | — | `{ message }` (drafts and returned only) |

Workflow steps: `encode → submit → review (Budget Head) → accountant → certification (Head of Agency) → release`. Certification also completes the release step. Statuses: `Draft`, `For Approval`, `Approved` (awaiting certification), `Released`, `Returned`, `Cancelled`. Submission checks required fields, complete line items and that the total fits the allotment balance. Back/return/reject and accountant approval need remarks; certification needs a signature. The backend must enforce who may act on each step.

## Allotment classes

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| GET | `/allotment-classes/:code/registry` | `fiscalYear` | `AllotmentClassRegistry` |

`:code` is `RAOPS`, `RAOMO`, `RAOCO` or `RAOFE`.

## BFARS reports

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| GET | `/bfars/bfars-1/qpro` | `fiscalYear`, `quarter`, `department`, `uacsMajor`, `allotmentClass`, `pap`, `fundSource`, `status` (empty = all) | `QproReport { rows: QproRow[], previousCount, options, period, asOf }` — one row per program/activity with physical target/actual and allotment/obligations/disbursements; the UI derives rates and groupings |
| GET | `/bfars/:id` | `fiscalYear`, `quarter` (`Q1`–`Q4`) | `BfarsReportData { columns, rows, totals?, metrics, chart?, notes, period, agency }` |

`:id` is `bfars-1` … `bfars-11`. The response is column-driven, so the backend defines each report's columns; the UI renders whatever it receives.

## Reports

| Method | Path | Query / Body | Response |
| --- | --- | --- | --- |
| GET | `/reports` | `category`, `search` | `ReportDefinition[]` |
| GET | `/reports/history` | — | `GeneratedReport[]` |
| POST | `/reports/generate` | `{ reportId, period, format: "PDF" \| "XLSX" \| "CSV" }` | `GeneratedReport` |

## Notifications

| Method | Path | Response |
| --- | --- | --- |
| GET | `/notifications` | `AppNotification[]` |
| PATCH | `/notifications/:id/read` | `{ message }` |
| POST | `/notifications/read-all` | `{ message }` |
