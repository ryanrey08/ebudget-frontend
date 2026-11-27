# Backend API change audit

What changed in `backend-api` since the frontend last synchronised with it,
traced through routes, form requests, policies, actions and API resources.

| | |
|---|---|
| Backend repository | `~/Desktop/backend/backend-api/backend-api` (read-only for this work) |
| Branch | `main`, up to date with `origin/main` (fetched 2026-11-26; nothing to pull, no local changes) |
| Latest commit | `ea276fd` Merge pull request #12 (`fix/https-follows-app-url`), 2026-11-26 00:51 +08:00 |
| Re-checked 2026-11-27 | `97ede5b` (3 more commits: per-system OpenAPI docs with Scramble at `/docs/{system}`, a Symfony security patch). **No API change**; see [API_DOCUMENTATION_AUDIT.md](API_DOCUMENTATION_AUDIT.md) |
| Previous sync point | `be2de1a` "minor update", 2026-11-11 (the auth integration, docs/AUTH_API_INTEGRATION.md) |
| Commits audited | 50 (`be2de1a..ea276fd`), 322 files, +19,657 / −65 |
| Backend docs used | `docs/ebudget/**` (per-feature guides and Postman collections), checked against the code |

## Conventions that apply to every endpoint

- **Base path** `/api/v1/ebudget`. Every route below needs `Authorization: Bearer <token>` from
  `POST /auth/login` (`auth:ebudget` guard). A token from eNGAS or SIMS gets 401.
- **Authorisation** is a `can:` policy on each route: the permission (403 `forbidden`) **and**, new in
  this range, status rules that answer **409 with a stable `code`** (e.g. `fiscal_year_not_open`). The
  exception renderer now keeps a policy's own code and message (`ApiExceptionRenderer::policyDenialCode`).
- **Errors** are `application/problem+json`: `{ type, title, status, code, detail, request_id, errors? }`.
  422 is `validation_failed` with `errors` per field (Laravel style, arrays of messages).
- **Lists** are Laravel paginators: `data`, `links`, `meta` (`current_page`, `per_page`, `total`, …),
  `?page=`, `?per_page=` 1–100 (default 15). Appropriations and allotments add `meta.total_amount`.
- **Money** is stored in centavos and always sent as a 2-decimal peso **string** (`"50000000.00"`);
  send strings, no thousands separators.
- **Ids**: integers for master data and appropriation lines; ULIDs for fiscal years, allotments,
  releases, attachments, approval requests/steps/workflows, signatories, users and roles.
- **Files** behind the token (logo, attachments, signatures) are not public URLs: responses carry an
  absolute `…_url` that must be fetched with the token.
- Every write is audited (domain events in `app/Events/EBudget`); nothing for the frontend to do.

## Endpoint changes

Change types: NEW, UPDATED, REMOVED, DEPRECATED, UNCHANGED. "Perm." is the permission
(`*.view` to read, `*.manage` to write). Nothing was REMOVED or DEPRECATED in this range.

### Authentication and access (shared by eBudget, eNGAS and SIMS)

| Module | Endpoint | Method | Change Type | Request/Response Changes | Frontend Impact |
|---|---|---|---|---|---|
| Auth | `/auth/login` | POST | UNCHANGED | `{ email, password, device_name? }` → `{ token_type, access_token, expires_at, user }`. Login attempts are now audited (`auth.login`, `auth.login_failed`) | None. Still proxied by `/api/auth/login` (httpOnly cookie) |
| Auth | `/auth/me` | GET | UNCHANGED | `{ data: CurrentSystemUser }` with `is_super_admin`, `permissions` | `permissions` now lists the eBudget-only catalog too; `Permission` type widened |
| Auth | `/auth/logout` | POST | UPDATED (internal) | Same contract (204); now an action `RevokeCurrentToken`, audited | None |
| Auth | `/auth/password` | PUT | **NEW** | `{ current_password, password, password_confirmation }` → 204. New password ≥ 12 chars, upper + lower case, number, symbol, differs from current, not breached (HIBP). Revokes the user's **other** tokens. 422 per field; 5 wrong current passwords in 15 min revoke the token (401). Throttle 5/min, 10/h per account (429) | New proxy route `src/app/api/auth/password`; Settings → Profile → Change Password now works in real auth mode |
| Roles | `/permissions` | GET | UPDATED | Lists only the caller's system catalog (`Permission::for(system)`), now incl. eBudget-only keys | Used by the new Roles page |
| Roles | `/roles` | GET | UNCHANGED | Paginated `RoleResource` (`key`, `built_in`, `permissions`, `users_count`) | New Roles & Permissions page |
| Roles | `/roles` | POST | UPDATED | `permissions.*` must be keys of the caller's own system (422 otherwise). 403 `insufficient_privileges` (with `missing_permissions`) / `super_admin_only` | New Roles page (create) |
| Roles | `/roles/{id}` | GET | UNCHANGED | One role | — |
| Roles | `/roles/{id}` | PATCH | UPDATED | Same system-scoped `permissions` rule; `permissions` replaces the list. 409 `built_in_role` | New Roles page (edit) |
| Roles | `/roles/{id}` | DELETE | UNCHANGED | 204; 409 `built_in_role` / `role_in_use` | New Roles page (delete) |
| Users | `/users` | GET | UNCHANGED | Paginated `SystemUserResource`, oldest first, no search filter | New Users page |
| Users | `/users` | POST | UNCHANGED | `{ name, email, role_ids? }` → 201 `{ data, temporary_password }` (`Cache-Control: no-store`) | New Users page; one-time password shown once, never cached |
| Users | `/users/{id}` | GET | UNCHANGED | One user | — |
| Users | `/users/{id}/roles` | PUT | UNCHANGED | `{ role_ids: [] }` replaces roles (perm. `roles.assign`) | Users page → Edit roles |
| Users | `/users/{id}/deactivate`, `/activate` | POST | UNCHANGED | 200; 409 `self_action` / `last_super_admin` | Users page |
| Reports | `/reports/datasets` | GET | UNCHANGED | `{ data: [{ key, description, source, shared_with_you }] }` (perm. `reports.view`) | New "Report datasets" card on Reports |
| Reports | `/reports/shares` | GET, POST | UNCHANGED | `{ data, datasets }`; POST `{ dataset, system }` (perm. `reports.share`) | Same card |
| Reports | `/reports/shares/{id}` | DELETE | UNCHANGED | 204 | Same card |
| Health | `/api/v1/health` | GET | UNCHANGED | No token | Not used by the UI |

### eBudget master data (`routes/ebudget.php`, prefix `/master-data`) — all NEW

| Module | Endpoint | Method | Change Type | Request/Response Changes | Frontend Impact |
|---|---|---|---|---|---|
| Fiscal years | `/master-data/fiscal-years` | GET | NEW | `?status=open\|closed\|locked`, newest first. `{ id (ULID), year, name ("FY 2026", generated), start_date, end_date, status, is_editable }` (perm. `fiscal_years.view`) | New page; also resolves the header's year to `fiscal_year_id` for every backend page |
| Fiscal years | `/master-data/fiscal-years` | POST | NEW | `{ year (1900–2999), start_date?, end_date? }`; defaults Jan 1–Dec 31; no duplicate year, no overlapping period (422); 201 + Location | Fiscal Years page |
| Fiscal years | `/master-data/fiscal-years/{id}` | GET, PATCH, DELETE | NEW | PATCH any of `year`, `start_date`, `end_date`; open years only (409 `fiscal_year_not_open`); DELETE 409 `fiscal_year_in_use` | Fiscal Years page |
| Fiscal years | `/{id}/close`, `/{id}/reopen`, `/{id}/lock` | POST | NEW | open → closed, closed → open, closed → locked (permanent). 409 `invalid_status_transition` | Row actions with confirmation (lock warns it's permanent) |
| PREXC items | `/master-data/prexc-items` (+ `/{id}`) | GET, POST, PATCH, DELETE | NEW | `{ code ≤30, parent_id?, is_parent_only, level ≥1, description ≤2000, sort_order ≥0, is_active }`; response adds `parent {id,code,description}`, `children_count`. Filters `parent_id`, `root=1`, `is_parent_only`, `is_active`, `level`, `search`. 409 `prexc_item_has_children` / `prexc_item_in_use`; 422 on a parent loop | PREXC Items page; PAP pickers use `is_parent_only=0` |
| Fund sources | `/master-data/fund-sources` (+ `/{id}`) | GET, POST, PATCH, DELETE | NEW | `{ code ≤20 (FUNDCD), description ≤255, is_active }`; `?is_active`, `?search`; 409 `fund_source_in_use` | Fund Sources page; pickers |
| Organizations | `/master-data/organizations` (+ `/{id}`) | GET, POST, PATCH, DELETE | NEW | `{ code ≤20, name ≤255, is_active }`; 409 `organization_in_use` | Organizations page; pickers and filters |
| Allotment classes | `/master-data/allotment-classes` (+ `/{id}`) | GET, POST, PATCH, DELETE | NEW | `{ code ≤10, description, registry_code RAOPS\|RAOMO\|RAOCO\|RAOFE (one class each), is_active }` + `registry_label`; `?registry_code`; seeded PS/MOOE/CO/FE; 409 `allotment_class_in_use` | Allotment Classes page (under Master Data; the sidebar's RAO registries are separate) |
| UACS objects | `/master-data/uacs-objects` (+ `/{id}`) | GET, POST, PATCH, DELETE | NEW | `{ code ≤20 (UACS_OBJ_CD), description ≤255 (UACS_OBJ_DSC), is_active }`; 409 `uacs_object_in_use` | UACS Objects page; pickers (searched on the server) |

### Appropriations and GAA upload — all NEW

| Module | Endpoint | Method | Change Type | Request/Response Changes | Frontend Impact |
|---|---|---|---|---|---|
| Appropriations | `/appropriations` | GET | NEW | One row per **line**. Filters `fiscal_year_id`, `organization_id`, `level`, `type`, `prexc_item_id`, `uacs_object_id`, `fund_source_id`, `allotment_class_id`, `has_balance=0\|1`, `search`; newest effectivity first; `meta.total_amount`. Line: `appropriation_no` (APP-2026-001), nested `fiscal_year`, `organization`, `prexc_item`, `uacs_object`, `fund_source`, `allotment_class`, `level(_label)`, `type(_label)`, `amount`, `allotted_amount`, `unallotted_amount`, `allotment` summary (perm. `appropriations.view`) | Appropriations page rewritten on this contract (was the demo `/appropriations` with categories/status) |
| Appropriations | `/appropriations` | POST | NEW | `{ fiscal_year_id, organization_id, title?, level agency\|operating_unit, type gaa\|supplemental\|continuing\|automatic\|unprogrammed, legal_reference?, effectivity_date, expiry_date?, prexc_item_id, uacs_object_id, fund_source_id, allotment_class_id, amount > 0 (15+2 digits), remarks? }`. Active records only; PAP not a heading; one line per FY+org+level+type+legal ref+PAP+UACS+fund (422 on `uacs_object_id`); 409 `fiscal_year_not_open` | New Appropriation page rewritten |
| Appropriations | `/appropriations/{id}` | GET, PATCH, DELETE | NEW | PATCH partial (period checked against stored values). Allotted lines: 409 `appropriation_in_use` (delete), `appropriation_allotted` (changing FY/org/codes), `appropriation_over_allotted` (amount below allotment) | New Edit page (`/appropriations/appropriations/{id}/edit`); locked fields disabled when allotted |
| GAA upload | `/appropriations/import/validate` | POST | NEW | multipart `file` (.xlsx by content, ≤ 5 MB, sheet "GAA Upload", headings row 4, ≤ 5,000 rows). 200 `{ valid, summary{rows,valid_rows,invalid_rows,total_amount}, errors[{row,column,field,heading,message}], lines[{row, valid, cells, …parsed ids}] }`; 422 on `file` when it isn't the template. Saves nothing | GAA Upload step 1 → step 2 (rewritten; replaces the demo `/gaa/uploads/*` batches, column mapping and per-row statuses) |
| GAA import | `/appropriations/imports` | POST | NEW | `{ level, legal_reference?, title?, effectivity_date?, expiry_date?, source_name?, lines[{ row?, cells }] }` → 202 queued import + Location, or 422 with every error keyed `lines.{i}.cells.{field}`. All lines or none | Step 3 (Configure) submits; 422 errors are mapped back onto the rows in step 2 |
| GAA import | `/appropriations/imports/{id}` | GET | NEW | `{ status queued\|processing\|completed\|failed, row_count, imported_count, total_amount, error_count, errors[{line,row,column,field,heading,message}], failure_message, … }` | Step 4 polls every 2 s until finished; failed errors can be sent back to step 2 |

### Allotments — all NEW

| Module | Endpoint | Method | Change Type | Request/Response Changes | Frontend Impact |
|---|---|---|---|---|---|
| Allotments | `/allotments` | GET | NEW | Filters `fiscal_year_id`, `appropriation_id`, `organization_id`, `status draft\|active\|fully_released\|cancelled`, `search`; `meta.total_amount`; rows include `releases` (no approvals/documents) (perm. `allotments.view`) | Allotments page rewritten (was the demo list with workflow groups) |
| Allotments | `/allotments` | POST | NEW | `{ appropriation_id, amount ≤ unallotted, purpose ≤500, release{ release_kind tranche\|full, amount? (tranche), release_date (in the line's period), reference_no? } }` → 201 draft with 1st tranche. 409 `appropriation_already_allotted` | New Allotment page rewritten: pick a line (`has_balance=1`), create, or add the next tranche when the line already has one |
| Allotments | `/allotments/{id}` | GET, PATCH, DELETE | NEW | GET with line, `releases[].approval`, `attachments`, totals (`released/pending/unreleased_amount`, `next_tranche_*`). PATCH `{ amount?, purpose? }`. DELETE only a never-submitted draft (409 `allotment_submitted`) | Allotment detail page rewritten |
| Allotments | `/allotments/{id}/cancel` | POST | NEW | `{ reason }`; not while a tranche is pending (409 `allotment_release_pending`) | Detail → Cancel allotment |
| Tranches | `/allotments/{id}/releases` | POST | NEW | Next tranche; one open tranche at a time (409 `allotment_release_open`) | Detail → Add tranche; New Allotment page |
| Tranches | `/allotments/{id}/releases/{release}` | PATCH, DELETE | NEW | Edit draft/rejected; delete draft only (409 `allotment_release_not_editable` / `_not_deletable`) | Tranche row actions |
| Tranches | `…/releases/{release}/submit` | POST | NEW | `{ remarks? }` → pending; 409 `no_active_approval_workflow` | Submit (with optional remarks) |
| Tranches | `…/releases/{release}/cancel` | POST | NEW | `{ reason }`; released or rejected only | Cancel tranche |
| Documents | `/allotments/{id}/attachments` | POST | NEW | multipart `file`: PDF, .xlsx, JPEG, PNG by content, ≤ 5 MB, ≤ 20 per allotment | Detail → Supporting documents |
| Documents | `/allotments/{id}/attachments/{a}` | GET, DELETE | NEW | GET downloads (needs token); DELETE only while draft and nothing pending (409 `allotment_attachments_locked`) | Download through the data proxy; remove |

### Approvals and system administration — all NEW

| Module | Endpoint | Method | Change Type | Request/Response Changes | Frontend Impact |
|---|---|---|---|---|---|
| Approval requests | `/approval-requests/{id}` | GET | NEW | `{ module, record_id, status, submitted_by, current_step_id, steps[{ sequence, name, user, signatory, requires_signature, status, remarks, acted_at, signed_position, signature_url }] }`. Visible to the submitter, any step user or `approval_requests.view`. **No list endpoint** | New page `/approvals/{id}`; embedded on the allotment page for the pending tranche |
| Approval requests | `…/steps/{step}/approve` | POST | NEW | multipart `signature` (PNG/JPEG ≤ 1 MB, ≤ 2000 px) **only** when the step has a signatory, `remarks?`. 403 `approval_not_your_turn`, 409 `approval_step_not_current` / `approval_not_pending` | Approve dialog with a signature pad (draw or upload) |
| Approval requests | `…/steps/{step}/reject` | POST | NEW | `{ remarks }` required; rejects the whole request (tranche → rejected) | Reject dialog |
| Approval requests | `…/steps/{step}/signature` | GET | NEW | The image, `no-store` | Shown via blob URL |
| Approval workflows | `/system-administration/approval-workflows` (+ `/{id}`) | GET, POST, PATCH, DELETE | NEW | `{ module allotment\|obligation_request\|budget_realignment (create only), name, is_active (one active per module), steps[{ name, user_id, signatory_id? }] (1–20, replaced as a whole) }`; 409 `approval_workflow_in_use` | New Approval Workflows page |
| Signatories | `/system-administration/signatories` (+ `/{id}`) | GET, POST, PATCH, DELETE | NEW | `{ user_id (active user), position ≤100 (unique per user), is_active }`; 409 `signatory_in_use` | New Signatories page |
| Agency profile | `/system-administration/agency-profile` | GET, PATCH | NEW | One record (seeded): `department_code, agency_code, agency_name, acronym, address, head_of_agency, logo_url`; PATCH fields can't be blank | New Agency Profile page |
| Agency profile | `/system-administration/agency-profile/logo` | GET, POST, DELETE | NEW | POST multipart `logo` (PNG/JPEG/WebP ≤ 2 MB, ≤ 4000 px); GET the image (token) | Logo upload/remove/preview |

### New permissions (`app/Enums/Permission.php`, eBudget-only)

`fiscal_years`, `prexc_items`, `fund_sources`, `organizations`, `allotment_classes`, `uacs_objects`,
`appropriations`, `allotments`, `agency_profile`, `approval_workflows`, `signatories` (each `.view` /
`.manage`) and `approval_requests.view`. Built-in `super_admin` and `admin` hold all of them.
Approving is **not** a permission: it belongs to each workflow step's user.

### New database schema (eBudget connection)

`fiscal_years`, `agency_profile`, `approval_workflows(+_steps)`, `approval_requests(+_steps)`,
`signatories`, `prexc_items`, `fund_sources`, `organizations`, `allotment_classes` (seeded),
`uacs_objects`, `appropriations` (+ `appropriation_no`, `appropriation_import_id`),
`appropriation_imports`, `allotments`, `allotment_releases`, `allotment_attachments`,
`document_sequences`; tamper-evident audit trail columns. Uniqueness, period overlap, positive amounts
and "one open tranche" are enforced by the database too.

### Non-API changes (no frontend impact)

Tamper-evident audit trail, CI/CD (GitHub Actions, Jenkins, image caching, rollback), opcache JIT off,
Laravel Pulse dashboard at `/pulse` (web, not API), `forceHttps` and secure cookies follow `APP_URL`,
maatwebsite/excel + gd in the image (needed by the GAA upload).

## Business rules the frontend must not invent

- Appropriations, allotments and tranches change only while their fiscal year is **open**.
- One allotment per appropriation line (a cancelled one doesn't count); tranches are numbered by the
  backend; a `full` release takes exactly what is left; only one open tranche at a time.
- Money counts as released only after the **last** approval step; a rejected tranche can be edited
  and submitted again (a new approval request).
- Released / pending / remaining amounts are computed by the backend; the frontend displays them.
