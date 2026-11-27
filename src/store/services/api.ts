import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "@/lib/api/client";

/**
 * Root RTK Query API. Feature modules add their endpoints with
 * `api.injectEndpoints()` (see src/features/<feature>/services).
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: [
    "Auth",
    "Profile",
    "Dashboard",
    "Appropriation",
    "Allotment",
    "GaaUpload",
    "Obligation",
    "AllotmentClass",
    "Bfars",
    "Report",
    "Notification",
    // eBudget backend modules (src/services/backend)
    "FiscalYear",
    "PrexcItem",
    "FundSource",
    "Organization",
    "BackendAllotmentClass",
    "UacsObject",
    "AppropriationLine",
    "GaaImport",
    "AllotmentRecord",
    "ApprovalRequest",
    "ApprovalWorkflow",
    "Signatory",
    "AgencyProfile",
    "User",
    "Role",
    "ReportShare",
  ],
  keepUnusedDataFor: 300,
  endpoints: () => ({}),
});
