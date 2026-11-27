# API documentation audit

Every endpoint of the official eBudget API documentation compared with `ebudget-frontend`, then
corrected or completed. Audited 2026-11-27.

| | |
|---|---|
| Official documentation | `http://139.59.96.9/docs/ebudget` (Scramble UI) and its OpenAPI 3.1.2 document `/docs/ebudget.json`, "eBudget API" 1.0.0, server `http://139.59.96.9/api/v1/ebudget` |
| Also checked | backend `main` at `97ede5b` (pulled 2026-11-27; 3 new commits since `ea276fd`, docs tooling and a Symfony patch only, **no API change**), `docs/ebudget/*.md`, routes, form requests and API resources |
| Frontend baseline | the 2026-11-26 sync ([BACKEND_API_CHANGE_AUDIT.md](BACKEND_API_CHANGE_AUDIT.md), [FRONTEND_API_INTEGRATION_AUDIT.md](FRONTEND_API_INTEGRATION_AUDIT.md)) |

## How the comparison was done

1. Parsed the OpenAPI document: every path and method, query parameters, request bodies (JSON and
   multipart, with required fields), response codes and the response schema of every resource.
2. Compared each against the frontend's endpoint constants (`BACKEND` in `src/lib/api/endpoints.ts`),
   services (`src/services/backend/*`), TypeScript contracts, RTK Query endpoints and the pages using
   their hooks.
3. Response schemas were compared field by field with the TypeScript interfaces (all 16 resources:
   agency profile, allotment, allotment class, appropriation, appropriation import, approval request,
   approval workflow, fiscal year, PREXC item, signatory, role, user, current user, UACS object,
   organization, fund source), plus the list envelopes (`data`, `links`, `meta` incl.
   `total_amount`), `POST /users` (`temporary_password`), the GAA validation report and the import.
4. Searched the whole codebase for direct `fetch`/Axios calls: none outside the API client and the
   Next.js route handlers.

Where the documentation is thin (Scramble shows no body fields for `POST/PATCH /master-data/prexc-items`
and `/system-administration/signatories`), the form requests were used: `PrexcItemRequest`,
`SignatoryRequest` (fields as in `docs/ebudget/master-data/prexc-items.md` and `signatories.md`).

## Summary

| | Before this audit | After |
|---|---|---|
| Documented endpoints | 94 | 94 |
| EXISTING AND CORRECT | 83 | **94** |
| EXISTING BUT INCORRECT | 1 (found live: attachment upload response, see below) | 0 |
| PARTIALLY IMPLEMENTED | 0 | 0 |
| MISSING | 0 | 0 |
| IMPLEMENTED BUT UNUSED | 10 (the `GET /{id}` show endpoints: six master-data resources, signatory, approval workflow, role, user) | 0 |
| NOT DOCUMENTED (frontend calls outside the docs) | Demo-module paths; 2 demo services whose paths collide with documented ones were **sent to the real backend in real mode** (bug) | Demo paths only, explicitly separated (below) |

Field-level result: every query parameter, request field, required flag, multipart field name and
response field in the documentation matches the frontend. The documentation lists no `page`
parameter (Scramble omits Laravel's paginator parameter); the backend accepts it and the frontend
sends it with `per_page`. Boolean filters (`is_active`, `has_balance`, `root`, `is_parent_only`) are
sent as `1`/`0`, which Laravel's `boolean` rule accepts.

## Corrections made in this audit

| Finding | Fix | Files |
|---|---|---|
| 10 documented show endpoints had services but no page used them | Edit forms now load the record with `GET /{id}` first (latest copy, own cache entry, invalidated on update): master data (6), signatories, approval workflows, roles, users (Edit roles) | `masterDataApi.ts`, `administrationApi.ts`, `approvalsApi.ts`, `accessApi.ts`, `ResourceManager.tsx` (`useGet`), `MasterDataViews.tsx`, `SignatoriesView.tsx`, `RolesView.tsx`, `UsersView.tsx`, `ApprovalWorkflowsView.tsx` |
| The demo obligation and RAO registry pages still call the old demo `/appropriations`, `/appropriations/lookups`, `/allotments`, `/gaa/*` contract. In real mode these paths are the backend's, so the requests reached the backend with the wrong contract | Those demo services mark every call `demo`; the client answers them from the demo API in real mode (while `NEXT_PUBLIC_API_DEMO_MODULES` is on) and never sends them to the backend | `src/lib/api/api-types.ts`, `api-client.ts`, `src/services/appropriations.service.ts`, `src/services/allotments.service.ts`, test in `tests/backend-services.test.ts` |
| Updates didn't refresh a record's own cache entry | Update/transition/role/activation mutations invalidate the item tag as well as the list | the four RTK files above |

No endpoint path, method, payload or parameter name needed correcting. One response type did (attachment upload), found in the live test below.

## Endpoint comparison

All requests: base `/api/v1/ebudget` (reached through the same-origin proxy `/api/v1`),
`Accept: application/json`, `X-Requested-With: XMLHttpRequest`, `Authorization: Bearer <token>` added
by the proxy from the httpOnly cookie (login excepted), JSON bodies with `Content-Type:
application/json`, multipart bodies with the browser's boundary. Errors: `application/problem+json`
(`code` kept as `ApiError.problemCode`, `detail` as the message, `errors` per field).

| Module | Documented Endpoint | Method | Frontend Status | Required Action | Frontend File |
|---|---|---|---|---|---|
| Authentication | `/auth/login` | POST | EXISTING AND CORRECT | None | authService.login → /api/auth/login; useLoginMutation; page /login |
| Authentication | `/auth/logout` | POST | EXISTING AND CORRECT | None | authService.logout → /api/auth/logout; useLogoutMutation; page Sidebar, user menu |
| Authentication | `/auth/me` | GET | EXISTING AND CORRECT | None | authService.me → /api/auth/me; useGetCurrentUserQuery; page AppShell, /settings/profile |
| Authentication | `/auth/password` | PUT | EXISTING AND CORRECT | None | settingsService.changePassword → /api/auth/password; useChangePasswordMutation; page /settings/profile |
| Roles & permissions | `/permissions` | GET | EXISTING AND CORRECT | None | accessService.permissions; useGetPermissionCatalogQuery; page /administration/roles |
| Roles & permissions | `/roles` | GET | EXISTING AND CORRECT | None | accessService.roles / createRole; useGetRolesQuery, useCreateRoleMutation; page /administration/roles, users role pickers |
| Roles & permissions | `/roles` | POST | EXISTING AND CORRECT | None | accessService.roles / createRole; useGetRolesQuery, useCreateRoleMutation; page /administration/roles, users role pickers |
| Roles & permissions | `/roles/{roleId}` | GET | EXISTING AND CORRECT | None | accessService.role / updateRole / deleteRole; useGetRoleQuery, useUpdateRoleMutation, useDeleteRoleMutation; page /administration/roles |
| Roles & permissions | `/roles/{roleId}` | PATCH | EXISTING AND CORRECT | None | accessService.role / updateRole / deleteRole; useGetRoleQuery, useUpdateRoleMutation, useDeleteRoleMutation; page /administration/roles |
| Roles & permissions | `/roles/{roleId}` | DELETE | EXISTING AND CORRECT | None | accessService.role / updateRole / deleteRole; useGetRoleQuery, useUpdateRoleMutation, useDeleteRoleMutation; page /administration/roles |
| Users | `/users` | GET | EXISTING AND CORRECT | None | accessService.users / createUser; useGetUsersQuery, useCreateUserMutation; page /administration/users, signatory & workflow user pickers |
| Users | `/users` | POST | EXISTING AND CORRECT | None | accessService.users / createUser; useGetUsersQuery, useCreateUserMutation; page /administration/users, signatory & workflow user pickers |
| Users | `/users/{userId}` | GET | EXISTING AND CORRECT | None | accessService.user; useGetUserQuery; page /administration/users (Edit roles) |
| Users | `/users/{userId}/activate` | POST | EXISTING AND CORRECT | None | accessService.activate; useSetUserActiveMutation; page /administration/users |
| Users | `/users/{userId}/deactivate` | POST | EXISTING AND CORRECT | None | accessService.deactivate; useSetUserActiveMutation; page /administration/users |
| Users | `/users/{userId}/roles` | PUT | EXISTING AND CORRECT | None | accessService.syncRoles; useSyncUserRolesMutation; page /administration/users |
| Fiscal years | `/master-data/fiscal-years` | GET | EXISTING AND CORRECT | None | masterDataService.fiscalYears.list / create; useGetFiscalYearsQuery, useCreateFiscalYearMutation; page /master-data/fiscal-years, pickers (LookupSelect) |
| Fiscal years | `/master-data/fiscal-years` | POST | EXISTING AND CORRECT | None | masterDataService.fiscalYears.list / create; useGetFiscalYearsQuery, useCreateFiscalYearMutation; page /master-data/fiscal-years, pickers (LookupSelect) |
| Fiscal years | `/master-data/fiscal-years/{fiscalYear}` | GET | EXISTING AND CORRECT | None | masterDataService.fiscalYears.get / update / remove; useGetFiscalYearQuery, useUpdateFiscalYearMutation, useDeleteFiscalYearMutation; page /master-data/fiscal-years (edit loads GET first) |
| Fiscal years | `/master-data/fiscal-years/{fiscalYear}` | PATCH | EXISTING AND CORRECT | None | masterDataService.fiscalYears.get / update / remove; useGetFiscalYearQuery, useUpdateFiscalYearMutation, useDeleteFiscalYearMutation; page /master-data/fiscal-years (edit loads GET first) |
| Fiscal years | `/master-data/fiscal-years/{fiscalYear}` | DELETE | EXISTING AND CORRECT | None | masterDataService.fiscalYears.get / update / remove; useGetFiscalYearQuery, useUpdateFiscalYearMutation, useDeleteFiscalYearMutation; page /master-data/fiscal-years (edit loads GET first) |
| Fiscal years | `/master-data/fiscal-years/{fiscalYear}/close` | POST | EXISTING AND CORRECT | None | masterDataService.fiscalYears.transition("close"); useTransitionFiscalYearMutation; page /master-data/fiscal-years |
| Fiscal years | `/master-data/fiscal-years/{fiscalYear}/lock` | POST | EXISTING AND CORRECT | None | masterDataService.fiscalYears.transition("lock"); useTransitionFiscalYearMutation; page /master-data/fiscal-years |
| Fiscal years | `/master-data/fiscal-years/{fiscalYear}/reopen` | POST | EXISTING AND CORRECT | None | masterDataService.fiscalYears.transition("reopen"); useTransitionFiscalYearMutation; page /master-data/fiscal-years |
| Organizations | `/master-data/organizations` | GET | EXISTING AND CORRECT | None | masterDataService.organizations.list / create; useGetOrganizationsQuery, useCreateOrganizationMutation; page /master-data/organizations, pickers (LookupSelect) |
| Organizations | `/master-data/organizations` | POST | EXISTING AND CORRECT | None | masterDataService.organizations.list / create; useGetOrganizationsQuery, useCreateOrganizationMutation; page /master-data/organizations, pickers (LookupSelect) |
| Organizations | `/master-data/organizations/{organization}` | GET | EXISTING AND CORRECT | None | masterDataService.organizations.get / update / remove; useGetOrganizationQuery, useUpdateOrganizationMutation, useDeleteOrganizationMutation; page /master-data/organizations (edit loads GET first) |
| Organizations | `/master-data/organizations/{organization}` | PATCH | EXISTING AND CORRECT | None | masterDataService.organizations.get / update / remove; useGetOrganizationQuery, useUpdateOrganizationMutation, useDeleteOrganizationMutation; page /master-data/organizations (edit loads GET first) |
| Organizations | `/master-data/organizations/{organization}` | DELETE | EXISTING AND CORRECT | None | masterDataService.organizations.get / update / remove; useGetOrganizationQuery, useUpdateOrganizationMutation, useDeleteOrganizationMutation; page /master-data/organizations (edit loads GET first) |
| PREXC items | `/master-data/prexc-items` | GET | EXISTING AND CORRECT | None | masterDataService.prexcItems.list / create; useGetPrexcItemsQuery, useCreatePrexcItemMutation; page /master-data/prexc-items, pickers (LookupSelect) |
| PREXC items | `/master-data/prexc-items` | POST | EXISTING AND CORRECT | None | masterDataService.prexcItems.list / create; useGetPrexcItemsQuery, useCreatePrexcItemMutation; page /master-data/prexc-items, pickers (LookupSelect) |
| PREXC items | `/master-data/prexc-items/{prexcItem}` | GET | EXISTING AND CORRECT | None | masterDataService.prexcItems.get / update / remove; useGetPrexcItemQuery, useUpdatePrexcItemMutation, useDeletePrexcItemMutation; page /master-data/prexc-items (edit loads GET first) |
| PREXC items | `/master-data/prexc-items/{prexcItem}` | PATCH | EXISTING AND CORRECT | None | masterDataService.prexcItems.get / update / remove; useGetPrexcItemQuery, useUpdatePrexcItemMutation, useDeletePrexcItemMutation; page /master-data/prexc-items (edit loads GET first) |
| PREXC items | `/master-data/prexc-items/{prexcItem}` | DELETE | EXISTING AND CORRECT | None | masterDataService.prexcItems.get / update / remove; useGetPrexcItemQuery, useUpdatePrexcItemMutation, useDeletePrexcItemMutation; page /master-data/prexc-items (edit loads GET first) |
| UACS objects | `/master-data/uacs-objects` | GET | EXISTING AND CORRECT | None | masterDataService.uacsObjects.list / create; useGetUacsObjectsQuery, useCreateUacsObjectMutation; page /master-data/uacs-objects, pickers (LookupSelect) |
| UACS objects | `/master-data/uacs-objects` | POST | EXISTING AND CORRECT | None | masterDataService.uacsObjects.list / create; useGetUacsObjectsQuery, useCreateUacsObjectMutation; page /master-data/uacs-objects, pickers (LookupSelect) |
| UACS objects | `/master-data/uacs-objects/{uacsObject}` | GET | EXISTING AND CORRECT | None | masterDataService.uacsObjects.get / update / remove; useGetUacsObjectQuery, useUpdateUacsObjectMutation, useDeleteUacsObjectMutation; page /master-data/uacs-objects (edit loads GET first) |
| UACS objects | `/master-data/uacs-objects/{uacsObject}` | PATCH | EXISTING AND CORRECT | None | masterDataService.uacsObjects.get / update / remove; useGetUacsObjectQuery, useUpdateUacsObjectMutation, useDeleteUacsObjectMutation; page /master-data/uacs-objects (edit loads GET first) |
| UACS objects | `/master-data/uacs-objects/{uacsObject}` | DELETE | EXISTING AND CORRECT | None | masterDataService.uacsObjects.get / update / remove; useGetUacsObjectQuery, useUpdateUacsObjectMutation, useDeleteUacsObjectMutation; page /master-data/uacs-objects (edit loads GET first) |
| Fund sources | `/master-data/fund-sources` | GET | EXISTING AND CORRECT | None | masterDataService.fundSources.list / create; useGetFundSourcesQuery, useCreateFundSourceMutation; page /master-data/fund-sources, pickers (LookupSelect) |
| Fund sources | `/master-data/fund-sources` | POST | EXISTING AND CORRECT | None | masterDataService.fundSources.list / create; useGetFundSourcesQuery, useCreateFundSourceMutation; page /master-data/fund-sources, pickers (LookupSelect) |
| Fund sources | `/master-data/fund-sources/{fundSource}` | GET | EXISTING AND CORRECT | None | masterDataService.fundSources.get / update / remove; useGetFundSourceQuery, useUpdateFundSourceMutation, useDeleteFundSourceMutation; page /master-data/fund-sources (edit loads GET first) |
| Fund sources | `/master-data/fund-sources/{fundSource}` | PATCH | EXISTING AND CORRECT | None | masterDataService.fundSources.get / update / remove; useGetFundSourceQuery, useUpdateFundSourceMutation, useDeleteFundSourceMutation; page /master-data/fund-sources (edit loads GET first) |
| Fund sources | `/master-data/fund-sources/{fundSource}` | DELETE | EXISTING AND CORRECT | None | masterDataService.fundSources.get / update / remove; useGetFundSourceQuery, useUpdateFundSourceMutation, useDeleteFundSourceMutation; page /master-data/fund-sources (edit loads GET first) |
| Allotment classes | `/master-data/allotment-classes` | GET | EXISTING AND CORRECT | None | masterDataService.allotmentClasses.list / create; useGetAllotmentClassRecordsQuery, useCreateAllotmentClassRecordMutation; page /master-data/allotment-classes, pickers (LookupSelect) |
| Allotment classes | `/master-data/allotment-classes` | POST | EXISTING AND CORRECT | None | masterDataService.allotmentClasses.list / create; useGetAllotmentClassRecordsQuery, useCreateAllotmentClassRecordMutation; page /master-data/allotment-classes, pickers (LookupSelect) |
| Allotment classes | `/master-data/allotment-classes/{allotmentClass}` | GET | EXISTING AND CORRECT | None | masterDataService.allotmentClasses.get / update / remove; useGetAllotmentClassRecordQuery, useUpdateAllotmentClassRecordMutation, useDeleteAllotmentClassRecordMutation; page /master-data/allotment-classes (edit loads GET first) |
| Allotment classes | `/master-data/allotment-classes/{allotmentClass}` | PATCH | EXISTING AND CORRECT | None | masterDataService.allotmentClasses.get / update / remove; useGetAllotmentClassRecordQuery, useUpdateAllotmentClassRecordMutation, useDeleteAllotmentClassRecordMutation; page /master-data/allotment-classes (edit loads GET first) |
| Allotment classes | `/master-data/allotment-classes/{allotmentClass}` | DELETE | EXISTING AND CORRECT | None | masterDataService.allotmentClasses.get / update / remove; useGetAllotmentClassRecordQuery, useUpdateAllotmentClassRecordMutation, useDeleteAllotmentClassRecordMutation; page /master-data/allotment-classes (edit loads GET first) |
| Appropriations | `/appropriations` | GET | EXISTING AND CORRECT | None | appropriationLinesService.list / create; useGetAppropriationLinesQuery, useCreateAppropriationLineMutation; page /appropriations/appropriations, /new, New Allotment line picker |
| Appropriations | `/appropriations` | POST | EXISTING AND CORRECT | None | appropriationLinesService.list / create; useGetAppropriationLinesQuery, useCreateAppropriationLineMutation; page /appropriations/appropriations, /new, New Allotment line picker |
| Appropriations | `/appropriations/{appropriation}` | GET | EXISTING AND CORRECT | None | appropriationLinesService.get / update / remove; useGetAppropriationLineQuery, useUpdateAppropriationLineMutation, useDeleteAppropriationLineMutation; page /appropriations/appropriations/{id}/edit, list, New Allotment (?appropriation=) |
| Appropriations | `/appropriations/{appropriation}` | PATCH | EXISTING AND CORRECT | None | appropriationLinesService.get / update / remove; useGetAppropriationLineQuery, useUpdateAppropriationLineMutation, useDeleteAppropriationLineMutation; page /appropriations/appropriations/{id}/edit, list, New Allotment (?appropriation=) |
| Appropriations | `/appropriations/{appropriation}` | DELETE | EXISTING AND CORRECT | None | appropriationLinesService.get / update / remove; useGetAppropriationLineQuery, useUpdateAppropriationLineMutation, useDeleteAppropriationLineMutation; page /appropriations/appropriations/{id}/edit, list, New Allotment (?appropriation=) |
| GAA upload | `/appropriations/import/validate` | POST | EXISTING AND CORRECT | None | appropriationLinesService.validateUpload (multipart); useValidateGaaUploadMutation; page /appropriations/gaa-upload (step 1) |
| GAA upload | `/appropriations/imports` | POST | EXISTING AND CORRECT | None | appropriationLinesService.submitImport; useSubmitGaaImportMutation; page /appropriations/gaa-upload (step 3) |
| GAA upload | `/appropriations/imports/{appropriationImport}` | GET | EXISTING AND CORRECT | None | appropriationLinesService.getImport; useGetGaaImportQuery (polled); page /appropriations/gaa-upload (step 4) |
| Allotments | `/allotments` | GET | EXISTING AND CORRECT | None | allotmentRecordsService.list / create; useGetAllotmentRecordsQuery, useCreateAllotmentRecordMutation; page /appropriations/allotments, /new |
| Allotments | `/allotments` | POST | EXISTING AND CORRECT | None | allotmentRecordsService.list / create; useGetAllotmentRecordsQuery, useCreateAllotmentRecordMutation; page /appropriations/allotments, /new |
| Allotments | `/allotments/{allotment}` | GET | EXISTING AND CORRECT | None | allotmentRecordsService.get / update / remove; useGetAllotmentRecordQuery, useUpdateAllotmentRecordMutation, useDeleteAllotmentRecordMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}` | PATCH | EXISTING AND CORRECT | None | allotmentRecordsService.get / update / remove; useGetAllotmentRecordQuery, useUpdateAllotmentRecordMutation, useDeleteAllotmentRecordMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}` | DELETE | EXISTING AND CORRECT | None | allotmentRecordsService.get / update / remove; useGetAllotmentRecordQuery, useUpdateAllotmentRecordMutation, useDeleteAllotmentRecordMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}/attachments` | POST | EXISTING AND CORRECT | None | allotmentRecordsService.uploadAttachment (multipart); useUploadAllotmentAttachmentMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}/attachments/{attachment}` | GET | EXISTING AND CORRECT | None | allotmentRecordsService.downloadAttachment / deleteAttachment; useDeleteAllotmentAttachmentMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}/attachments/{attachment}` | DELETE | EXISTING AND CORRECT | None | allotmentRecordsService.downloadAttachment / deleteAttachment; useDeleteAllotmentAttachmentMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}/cancel` | POST | EXISTING AND CORRECT | None | allotmentRecordsService.cancel; useCancelAllotmentRecordMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}/releases` | POST | EXISTING AND CORRECT | None | allotmentRecordsService.addRelease; useAddAllotmentReleaseMutation; page /appropriations/allotments/{id}, /new |
| Allotments | `/allotments/{allotment}/releases/{release}` | PATCH | EXISTING AND CORRECT | None | allotmentRecordsService.updateRelease / deleteRelease; useUpdateAllotmentReleaseMutation, useDeleteAllotmentReleaseMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}/releases/{release}` | DELETE | EXISTING AND CORRECT | None | allotmentRecordsService.updateRelease / deleteRelease; useUpdateAllotmentReleaseMutation, useDeleteAllotmentReleaseMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}/releases/{release}/cancel` | POST | EXISTING AND CORRECT | None | allotmentRecordsService.cancelRelease; useCancelAllotmentReleaseMutation; page /appropriations/allotments/{id} |
| Allotments | `/allotments/{allotment}/releases/{release}/submit` | POST | EXISTING AND CORRECT | None | allotmentRecordsService.submitRelease; useSubmitAllotmentReleaseMutation; page /appropriations/allotments/{id}, /new |
| Approval requests | `/approval-requests/{approvalRequest}` | GET | EXISTING AND CORRECT | None | approvalRequestsService.get; useGetApprovalRequestQuery; page /approvals/{id}, allotment detail |
| Approval requests | `/approval-requests/{approvalRequest}/steps/{step}/approve` | POST | EXISTING AND CORRECT | None | approvalRequestsService.approve (multipart); useApproveApprovalStepMutation; page /approvals/{id} |
| Approval requests | `/approval-requests/{approvalRequest}/steps/{step}/reject` | POST | EXISTING AND CORRECT | None | approvalRequestsService.reject; useRejectApprovalStepMutation; page /approvals/{id} |
| Approval requests | `/approval-requests/{approvalRequest}/steps/{step}/signature` | GET | EXISTING AND CORRECT | None | approvalRequestsService.signature; AuthorizedImage; page /approvals/{id} |
| Approval workflows | `/system-administration/approval-workflows` | GET | EXISTING AND CORRECT | None | approvalWorkflowsService.list / create; useGetApprovalWorkflowsQuery, useCreateApprovalWorkflowMutation; page /administration/approval-workflows, allotment workflow preview |
| Approval workflows | `/system-administration/approval-workflows` | POST | EXISTING AND CORRECT | None | approvalWorkflowsService.list / create; useGetApprovalWorkflowsQuery, useCreateApprovalWorkflowMutation; page /administration/approval-workflows, allotment workflow preview |
| Approval workflows | `/system-administration/approval-workflows/{approvalWorkflow}` | GET | EXISTING AND CORRECT | None | approvalWorkflowsService.get / update / remove; useGetApprovalWorkflowQuery, useUpdateApprovalWorkflowMutation, useDeleteApprovalWorkflowMutation; page /administration/approval-workflows |
| Approval workflows | `/system-administration/approval-workflows/{approvalWorkflow}` | PATCH | EXISTING AND CORRECT | None | approvalWorkflowsService.get / update / remove; useGetApprovalWorkflowQuery, useUpdateApprovalWorkflowMutation, useDeleteApprovalWorkflowMutation; page /administration/approval-workflows |
| Approval workflows | `/system-administration/approval-workflows/{approvalWorkflow}` | DELETE | EXISTING AND CORRECT | None | approvalWorkflowsService.get / update / remove; useGetApprovalWorkflowQuery, useUpdateApprovalWorkflowMutation, useDeleteApprovalWorkflowMutation; page /administration/approval-workflows |
| Signatories | `/system-administration/signatories` | GET | EXISTING AND CORRECT | None | signatoriesService.list / create; useGetSignatoriesQuery, useCreateSignatoryMutation; page /administration/signatories, workflow editor |
| Signatories | `/system-administration/signatories` | POST | EXISTING AND CORRECT | None | signatoriesService.list / create; useGetSignatoriesQuery, useCreateSignatoryMutation; page /administration/signatories, workflow editor |
| Signatories | `/system-administration/signatories/{signatory}` | GET | EXISTING AND CORRECT | None | signatoriesService.get / update / remove; useGetSignatoryQuery, useUpdateSignatoryMutation, useDeleteSignatoryMutation; page /administration/signatories |
| Signatories | `/system-administration/signatories/{signatory}` | PATCH | EXISTING AND CORRECT | None | signatoriesService.get / update / remove; useGetSignatoryQuery, useUpdateSignatoryMutation, useDeleteSignatoryMutation; page /administration/signatories |
| Signatories | `/system-administration/signatories/{signatory}` | DELETE | EXISTING AND CORRECT | None | signatoriesService.get / update / remove; useGetSignatoryQuery, useUpdateSignatoryMutation, useDeleteSignatoryMutation; page /administration/signatories |
| Agency profile | `/system-administration/agency-profile` | GET | EXISTING AND CORRECT | None | agencyProfileService.get / update; useGetAgencyProfileQuery, useUpdateAgencyProfileMutation; page /administration/agency-profile |
| Agency profile | `/system-administration/agency-profile` | PATCH | EXISTING AND CORRECT | None | agencyProfileService.get / update; useGetAgencyProfileQuery, useUpdateAgencyProfileMutation; page /administration/agency-profile |
| Agency profile | `/system-administration/agency-profile/logo` | GET | EXISTING AND CORRECT | None | agencyProfileService.logo / uploadLogo / removeLogo; AuthorizedImage, useUploadAgencyLogoMutation, useRemoveAgencyLogoMutation; page /administration/agency-profile |
| Agency profile | `/system-administration/agency-profile/logo` | POST | EXISTING AND CORRECT | None | agencyProfileService.logo / uploadLogo / removeLogo; AuthorizedImage, useUploadAgencyLogoMutation, useRemoveAgencyLogoMutation; page /administration/agency-profile |
| Agency profile | `/system-administration/agency-profile/logo` | DELETE | EXISTING AND CORRECT | None | agencyProfileService.logo / uploadLogo / removeLogo; AuthorizedImage, useUploadAgencyLogoMutation, useRemoveAgencyLogoMutation; page /administration/agency-profile |
| Reports | `/reports/datasets` | GET | EXISTING AND CORRECT | None | reportSharingService.datasets; useGetReportDatasetsQuery; page /reports (Report datasets card) |
| Reports | `/reports/shares` | GET | EXISTING AND CORRECT | None | reportSharingService.shares / share; useGetReportSharesQuery, useShareReportDatasetMutation; page /reports |
| Reports | `/reports/shares` | POST | EXISTING AND CORRECT | None | reportSharingService.shares / share; useGetReportSharesQuery, useShareReportDatasetMutation; page /reports |
| Reports | `/reports/shares/{shareId}` | DELETE | EXISTING AND CORRECT | None | reportSharingService.unshare; useUnshareReportDatasetMutation; page /reports |
## Per-endpoint contract (from the official documentation)

`*` = required. Responses list the documented status codes; 2xx bodies show the top-level fields.
Single resources come as `{ data: … }` (the client unwraps `data`), lists as `{ data, links, meta }`
(normalised to `Paginated<T>`, extra `meta` such as `total_amount` kept in `Paginated.meta`).

- **POST `/auth/login`** (Authentication). Auth: None. Path: —. Query: —. Body: application/json: email*, password*, device_name. Responses: 200 application/json {token_type, access_token, expires_at, user}; 429; 422.
- **POST `/auth/logout`** (Authentication). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 204 (no body); 401.
- **GET `/auth/me`** (Authentication). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 200 application/json {data}; 401.
- **PUT `/auth/password`** (Authentication). Auth: Bearer token. Path: —. Query: —. Body: application/json: current_password*, password*, password_confirmation*. Responses: 204 (no body); 429; 401; 422.
- **GET `/permissions`** (Roles & permissions). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 200 application/json {data}; 403; 401.
- **GET `/roles`** (Roles & permissions). Auth: Bearer token. Path: —. Query: per_page. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/roles`** (Roles & permissions). Auth: Bearer token. Path: —. Query: —. Body: application/json: name*, description, permissions*. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/roles/{roleId}`** (Roles & permissions). Auth: Bearer token. Path: roleId. Query: —. Body: —. Responses: 200 application/json {data}; 403; 401.
- **PATCH `/roles/{roleId}`** (Roles & permissions). Auth: Bearer token. Path: roleId. Query: —. Body: application/json: name, description, permissions. Responses: 200 application/json {data}; 403; 401; 422.
- **DELETE `/roles/{roleId}`** (Roles & permissions). Auth: Bearer token. Path: roleId. Query: —. Body: —. Responses: 204 (no body); 403; 401.
- **GET `/users`** (Users). Auth: Bearer token. Path: —. Query: per_page. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/users`** (Users). Auth: Bearer token. Path: —. Query: —. Body: application/json: name*, email*, role_ids. Responses: 201 application/json {data, temporary_password}; 403; 401; 422.
- **GET `/users/{userId}`** (Users). Auth: Bearer token. Path: userId. Query: —. Body: —. Responses: 200 application/json {data}; 403; 401.
- **POST `/users/{userId}/activate`** (Users). Auth: Bearer token. Path: userId. Query: —. Body: —. Responses: 200 application/json {data}; 403; 401.
- **POST `/users/{userId}/deactivate`** (Users). Auth: Bearer token. Path: userId. Query: —. Body: —. Responses: 200 application/json {data}; 403; 401.
- **PUT `/users/{userId}/roles`** (Users). Auth: Bearer token. Path: userId. Query: —. Body: application/json: role_ids*. Responses: 200 application/json {data}; 403; 401; 422.
- **GET `/master-data/fiscal-years`** (Fiscal years). Auth: Bearer token. Path: —. Query: per_page, status. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/master-data/fiscal-years`** (Fiscal years). Auth: Bearer token. Path: —. Query: —. Body: application/json: year*, start_date, end_date. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/master-data/fiscal-years/{fiscalYear}`** (Fiscal years). Auth: Bearer token. Path: fiscalYear. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/master-data/fiscal-years/{fiscalYear}`** (Fiscal years). Auth: Bearer token. Path: fiscalYear. Query: —. Body: application/json: year, start_date, end_date. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/master-data/fiscal-years/{fiscalYear}`** (Fiscal years). Auth: Bearer token. Path: fiscalYear. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **POST `/master-data/fiscal-years/{fiscalYear}/close`** (Fiscal years). Auth: Bearer token. Path: fiscalYear. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **POST `/master-data/fiscal-years/{fiscalYear}/lock`** (Fiscal years). Auth: Bearer token. Path: fiscalYear. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **POST `/master-data/fiscal-years/{fiscalYear}/reopen`** (Fiscal years). Auth: Bearer token. Path: fiscalYear. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **GET `/master-data/organizations`** (Organizations). Auth: Bearer token. Path: —. Query: per_page, is_active, search. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/master-data/organizations`** (Organizations). Auth: Bearer token. Path: —. Query: —. Body: application/json: code*, name*, is_active. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/master-data/organizations/{organization}`** (Organizations). Auth: Bearer token. Path: organization. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/master-data/organizations/{organization}`** (Organizations). Auth: Bearer token. Path: organization. Query: —. Body: application/json: code, name, is_active. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/master-data/organizations/{organization}`** (Organizations). Auth: Bearer token. Path: organization. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **GET `/master-data/prexc-items`** (PREXC items). Auth: Bearer token. Path: —. Query: per_page, parent_id, root, is_parent_only, is_active, level, search. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/master-data/prexc-items`** (PREXC items). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/master-data/prexc-items/{prexcItem}`** (PREXC items). Auth: Bearer token. Path: prexcItem. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/master-data/prexc-items/{prexcItem}`** (PREXC items). Auth: Bearer token. Path: prexcItem. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/master-data/prexc-items/{prexcItem}`** (PREXC items). Auth: Bearer token. Path: prexcItem. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **GET `/master-data/uacs-objects`** (UACS objects). Auth: Bearer token. Path: —. Query: per_page, is_active, search. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/master-data/uacs-objects`** (UACS objects). Auth: Bearer token. Path: —. Query: —. Body: application/json: code*, description*, is_active. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/master-data/uacs-objects/{uacsObject}`** (UACS objects). Auth: Bearer token. Path: uacsObject. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/master-data/uacs-objects/{uacsObject}`** (UACS objects). Auth: Bearer token. Path: uacsObject. Query: —. Body: application/json: code, description, is_active. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/master-data/uacs-objects/{uacsObject}`** (UACS objects). Auth: Bearer token. Path: uacsObject. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **GET `/master-data/fund-sources`** (Fund sources). Auth: Bearer token. Path: —. Query: per_page, is_active, search. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/master-data/fund-sources`** (Fund sources). Auth: Bearer token. Path: —. Query: —. Body: application/json: code*, description*, is_active. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/master-data/fund-sources/{fundSource}`** (Fund sources). Auth: Bearer token. Path: fundSource. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/master-data/fund-sources/{fundSource}`** (Fund sources). Auth: Bearer token. Path: fundSource. Query: —. Body: application/json: code, description, is_active. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/master-data/fund-sources/{fundSource}`** (Fund sources). Auth: Bearer token. Path: fundSource. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **GET `/master-data/allotment-classes`** (Allotment classes). Auth: Bearer token. Path: —. Query: per_page, is_active, registry_code, search. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/master-data/allotment-classes`** (Allotment classes). Auth: Bearer token. Path: —. Query: —. Body: application/json: code*, description*, registry_code*, is_active. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/master-data/allotment-classes/{allotmentClass}`** (Allotment classes). Auth: Bearer token. Path: allotmentClass. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/master-data/allotment-classes/{allotmentClass}`** (Allotment classes). Auth: Bearer token. Path: allotmentClass. Query: —. Body: application/json: code, description, registry_code, is_active. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/master-data/allotment-classes/{allotmentClass}`** (Allotment classes). Auth: Bearer token. Path: allotmentClass. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **GET `/appropriations`** (Appropriations). Auth: Bearer token. Path: —. Query: per_page, fiscal_year_id, level, type, search, has_balance, organization_id, prexc_item_id, uacs_object_id, fund_source_id, allotment_class_id. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/appropriations`** (Appropriations). Auth: Bearer token. Path: —. Query: —. Body: application/json: fiscal_year_id*, organization_id*, title, level*, type*, legal_reference, effectivity_date*, expiry_date, prexc_item_id*, uacs_object_id*, fund_source_id*, allotment_class_id*, amount*, remarks. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/appropriations/{appropriation}`** (Appropriations). Auth: Bearer token. Path: appropriation. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/appropriations/{appropriation}`** (Appropriations). Auth: Bearer token. Path: appropriation. Query: —. Body: application/json: fiscal_year_id, organization_id, title, level, type, legal_reference, effectivity_date, expiry_date, prexc_item_id, uacs_object_id, fund_source_id, allotment_class_id, amount, remarks. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/appropriations/{appropriation}`** (Appropriations). Auth: Bearer token. Path: appropriation. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **POST `/appropriations/import/validate`** (GAA upload). Auth: Bearer token. Path: —. Query: —. Body: multipart/form-data: file*. Responses: 200 application/json {data}; 403; 401; 422.
- **POST `/appropriations/imports`** (GAA upload). Auth: Bearer token. Path: —. Query: —. Body: application/json: source_name, level*, title, legal_reference, effectivity_date, expiry_date, lines*. Responses: 202 application/json {data}; 403; 401; 422.
- **GET `/appropriations/imports/{appropriationImport}`** (GAA upload). Auth: Bearer token. Path: appropriationImport. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **GET `/allotments`** (Allotments). Auth: Bearer token. Path: —. Query: per_page, fiscal_year_id, appropriation_id, organization_id, status, search. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/allotments`** (Allotments). Auth: Bearer token. Path: —. Query: —. Body: application/json: appropriation_id*, amount*, purpose*, release*. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/allotments/{allotment}`** (Allotments). Auth: Bearer token. Path: allotment. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/allotments/{allotment}`** (Allotments). Auth: Bearer token. Path: allotment. Query: —. Body: application/json: amount, purpose. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/allotments/{allotment}`** (Allotments). Auth: Bearer token. Path: allotment. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **POST `/allotments/{allotment}/attachments`** (Allotments). Auth: Bearer token. Path: allotment. Query: —. Body: multipart/form-data: file*. Responses: 201 application/json {data}; 404; 403; 401; 422.
- **GET `/allotments/{allotment}/attachments/{attachment}`** (Allotments). Auth: Bearer token. Path: allotment, attachment. Query: —. Body: —. Responses: 200 application/octet-stream; 404; 403; 401.
- **DELETE `/allotments/{allotment}/attachments/{attachment}`** (Allotments). Auth: Bearer token. Path: allotment, attachment. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **POST `/allotments/{allotment}/cancel`** (Allotments). Auth: Bearer token. Path: allotment. Query: —. Body: application/json: reason*. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **POST `/allotments/{allotment}/releases`** (Allotments). Auth: Bearer token. Path: allotment. Query: —. Body: application/json: release_kind*, amount, release_date*, reference_no. Responses: 201 application/json {data}; 404; 403; 401; 422.
- **PATCH `/allotments/{allotment}/releases/{release}`** (Allotments). Auth: Bearer token. Path: allotment, release. Query: —. Body: application/json: release_kind, amount, release_date, reference_no. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/allotments/{allotment}/releases/{release}`** (Allotments). Auth: Bearer token. Path: allotment, release. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **POST `/allotments/{allotment}/releases/{release}/cancel`** (Allotments). Auth: Bearer token. Path: allotment, release. Query: —. Body: application/json: reason*. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **POST `/allotments/{allotment}/releases/{release}/submit`** (Allotments). Auth: Bearer token. Path: allotment, release. Query: —. Body: application/json: remarks. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **GET `/approval-requests/{approvalRequest}`** (Approval requests). Auth: Bearer token. Path: approvalRequest. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **POST `/approval-requests/{approvalRequest}/steps/{step}/approve`** (Approval requests). Auth: Bearer token. Path: approvalRequest, step. Query: —. Body: multipart/form-data: signature, remarks. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **POST `/approval-requests/{approvalRequest}/steps/{step}/reject`** (Approval requests). Auth: Bearer token. Path: approvalRequest, step. Query: —. Body: application/json: remarks*. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **GET `/approval-requests/{approvalRequest}/steps/{step}/signature`** (Approval requests). Auth: Bearer token. Path: approvalRequest, step. Query: —. Body: —. Responses: 200 application/octet-stream; 404; 403; 401.
- **GET `/system-administration/approval-workflows`** (Approval workflows). Auth: Bearer token. Path: —. Query: per_page, module, is_active. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/system-administration/approval-workflows`** (Approval workflows). Auth: Bearer token. Path: —. Query: —. Body: application/json: module*, name*, is_active, steps*. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/system-administration/approval-workflows/{approvalWorkflow}`** (Approval workflows). Auth: Bearer token. Path: approvalWorkflow. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/system-administration/approval-workflows/{approvalWorkflow}`** (Approval workflows). Auth: Bearer token. Path: approvalWorkflow. Query: —. Body: application/json: module, name, is_active, steps. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/system-administration/approval-workflows/{approvalWorkflow}`** (Approval workflows). Auth: Bearer token. Path: approvalWorkflow. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **GET `/system-administration/signatories`** (Signatories). Auth: Bearer token. Path: —. Query: per_page, user_id, is_active. Body: —. Responses: 200 application/json {data, links, meta}; 403; 401; 422.
- **POST `/system-administration/signatories`** (Signatories). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 201 application/json {data}; 403; 401; 422.
- **GET `/system-administration/signatories/{signatory}`** (Signatories). Auth: Bearer token. Path: signatory. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/system-administration/signatories/{signatory}`** (Signatories). Auth: Bearer token. Path: signatory. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401; 422.
- **DELETE `/system-administration/signatories/{signatory}`** (Signatories). Auth: Bearer token. Path: signatory. Query: —. Body: —. Responses: 204 (no body); 404; 403; 401.
- **GET `/system-administration/agency-profile`** (Agency profile). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 200 application/json {data}; 404; 403; 401.
- **PATCH `/system-administration/agency-profile`** (Agency profile). Auth: Bearer token. Path: —. Query: —. Body: application/json: department_code, agency_code, agency_name, acronym, address, head_of_agency. Responses: 200 application/json {data}; 403; 401; 422.
- **GET `/system-administration/agency-profile/logo`** (Agency profile). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 200 application/octet-stream; 404; 403; 401.
- **POST `/system-administration/agency-profile/logo`** (Agency profile). Auth: Bearer token. Path: —. Query: —. Body: multipart/form-data: logo*. Responses: 200 application/json {data}; 403; 401; 422.
- **DELETE `/system-administration/agency-profile/logo`** (Agency profile). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 200 application/json {data}; 403; 401.
- **GET `/reports/datasets`** (Reports). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 200 application/json {data}; 403; 401.
- **GET `/reports/shares`** (Reports). Auth: Bearer token. Path: —. Query: —. Body: —. Responses: 200 application/json {data, datasets}; 403; 401.
- **POST `/reports/shares`** (Reports). Auth: Bearer token. Path: —. Query: —. Body: application/json: dataset*, system*. Responses: 200 application/json; 403; 401; 422.
- **DELETE `/reports/shares/{shareId}`** (Reports). Auth: Bearer token. Path: shareId. Query: —. Body: —. Responses: 204 (no body); 403; 401.

## Frontend calls not covered by the documentation

| Call | What it is | Status |
|---|---|---|
| `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/password` | The frontend's own Next.js route handlers in front of the documented `/auth/*` (token kept in an httpOnly cookie) | Intended; documented in API_INTEGRATION.md |
| `/api/v1/*` | The frontend's data proxy in front of every documented endpoint | Intended |
| `/dashboard/*`, `/obligations/*`, `/allotment-classes/{code}/*`, `/allotments/registry`, `/allotments/{id}/registry`, `/bfars/*`, `/reports`, `/reports/history/*`, `/reports/generate`, `/notifications/*`, `/profile/*` | Demo modules: the backend has no such endpoints. Answered by the demo API in real mode (`DEMO_ONLY_PATHS`), pages show "Demo data" | Kept on purpose until the backend provides them; no silent fallback when a real call fails |
| Demo `appropriationsService` / `gaaService` / `allotmentsService` (old contract on `/appropriations`, `/gaa/*`, `/allotments`) | Lookups and lists for the demo obligation and RAO registry pages | Now marked `demo`, never sent to the backend |
| `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` | Mock auth only | Not available with real auth (no backend endpoints) |
| `GET /api/v1/health` | Shared health check, not in the eBudget document | Not used by the UI |

## Verification

| Level | Result |
|---|---|
| Code | Every endpoint's constant, service, TypeScript contract, RTK endpoint and consuming page checked (table above). `tsc --noEmit` clean, ESLint clean, 97 Vitest tests pass (fetch stubs in the documented formats, proxy tests), production build succeeds |
| Hosted server, read-only | `GET /api/v1/health` 200; unauthenticated calls answer the documented 401 `application/problem+json`; `POST /auth/login` with an empty body answers the documented 422 with `errors.email` / `errors.password`. Through the frontend (production build, `BACKEND_API_URL=http://139.59.96.9/api/v1`): the auth proxy passed the 422 through unchanged, and the data proxy forwarded an invalid token, passed the backend's 401 through and cleared the session cookie |
| Runtime with a signed-in user | Done on the local backend, see below. Not run against the hosted server (no application account) |

## Live verification on the local backend (2026-11-27)

Backend `main` `97ede5b` in Docker (`laravel-api`), migrated and seeded; frontend production build
(real mode) on `localhost:3010`, signed in as `admin@ebudget.com` (super admin). Requests went
through the frontend's own proxies (`/api/auth/*`, `/api/v1/*`), and the pages were opened in a
browser.

| Area | Exercised live | Result |
|---|---|---|
| Auth | login, `me` (31 permissions), password change (validation path only, to keep your password), invalid token → 401 + cookie cleared | Pass |
| Users / roles / permissions | list, create user (one-time password), show, sync roles, deactivate / activate, self-deactivation 409, role create / patch / show / delete, built-in role 409, role in use 409, invalid permission 422 | Pass |
| Fiscal years | create, duplicate 422, list, show, close, change in a closed year refused, reopen, invalid transition 409 | Pass (lock not run: it's permanent) |
| Master data | organizations, UACS objects (11), fund sources, PREXC heading + 4 PAPs, search, `is_active` filter, deactivate, delete, in-use 409, has-children 409, registry clash 422, registry filter | Pass |
| Appropriations | list with `meta.total_amount`, filters, search, show, patch, amount 422, delete allotted line 409 | Pass |
| GAA upload | validate the template (11 errors without master data, then 11 valid rows, ₱113M), import with bad cells 422 per `lines.{i}.cells.{field}`, queued import → completed (11 lines), duplicate import 422 | Pass |
| Allotments | over-allotment 422, create (ALT-2026-001), one per line 409, upload / download / type check of documents, one open tranche 409, submit, cancel while pending 409, edit tranche, full release, reject, cancel rejected tranche, edit allotment, locked documents 409, delete submitted 409 | Pass after one fix (below) |
| Approvals | request show, approve without signature 422, approve with PNG signature, double approve 409, signature image, reject | Pass |
| Administration | signatory create / show, workflow create / show (active `allotment` workflow), agency profile patch, blank field 422, logo upload / get / delete | Pass |
| Reports | datasets, shares | Pass (no datasets registered for eBudget yet) |
| More success paths | organization / UACS / PREXC create-show-patch-delete, allotment-class show / patch, FY 2099 create / patch / delete, signatory and workflow (2 steps) patch / delete, manual appropriation create / delete, full-release allotment, PDF upload and delete while draft, delete draft allotment, cancel allotment (line allottable again), logout then `me` 401 | Pass |
| Not called | `POST /fiscal-years/{id}/lock` (permanent), `DELETE /master-data/allotment-classes/{id}` (only the four seeded, in-use classes), `DELETE /reports/shares/{id}` (no eBudget datasets to share; `POST` with an unknown dataset answered 404) | Code-level only |
| Pages | 23 routes opened signed in: appropriations list / new / edit, GAA upload, allotments list / new / detail (incl. a document uploaded from the page), approval request (signature image shown), all master-data and administration pages, profile, and the demo pages | All load without errors; demo pages show the notice |

**Found and fixed live:** `POST /allotments/{id}/attachments` answers **201 with the attachment
only** (`AllotmentAttachmentResource`), not the whole allotment as
`docs/ebudget/allotments/allotments.md` says ("The release and attachment endpoints answer with the
whole allotment"). The frontend had written that response into the allotment's cache. It now types
it as an attachment and refetches the allotment. The OpenAPI document shows only the status code, so
the controller (`AllotmentAttachmentController::store`) decides.

**Test data left in your local database:** FY 2026 (open); organization `08 011 0000000`; 11 UACS
objects; fund sources 101 and 151; PREXC heading PAP-000 with PAP-001…004; 11 appropriation lines
from the template (APP-2026-001…011, ₱113M); allotment ALT-2026-001 (₱2M, 1st tranche released,
2nd cancelled, 3 documents); a cancelled ₱1,000 allotment on another line; signatory "Budget Officer" for Admin; approval workflow "Standard"
(allotment, active); user `test.encoder@ebudget.test` (deactivated). The agency logo was uploaded
and removed again.
