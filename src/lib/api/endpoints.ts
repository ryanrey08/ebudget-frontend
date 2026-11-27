/**
 * Every backend path used by the frontend, relative to NEXT_PUBLIC_API_BASE_URL.
 * The mock API registers handlers for exactly these paths, so swapping to the
 * real backend only requires the backend to implement the same contract.
 */
/**
 * Routes of the eBudget backend (backend-api `main`, routes/api.php and
 * routes/ebudget.php), relative to /api/v1/ebudget. In real mode they reach
 * the backend through the data proxy (/api/v1/*). They have no mock
 * handlers: services call them with `requiresBackend`.
 */
export const BACKEND = {
  fiscalYears: "/master-data/fiscal-years",
  fiscalYear: (id: string) => `/master-data/fiscal-years/${id}`,
  fiscalYearTransition: (id: string, action: "close" | "reopen" | "lock") => `/master-data/fiscal-years/${id}/${action}`,
  prexcItems: "/master-data/prexc-items",
  prexcItem: (id: number) => `/master-data/prexc-items/${id}`,
  fundSources: "/master-data/fund-sources",
  fundSource: (id: number) => `/master-data/fund-sources/${id}`,
  organizations: "/master-data/organizations",
  organization: (id: number) => `/master-data/organizations/${id}`,
  allotmentClasses: "/master-data/allotment-classes",
  allotmentClass: (id: number) => `/master-data/allotment-classes/${id}`,
  uacsObjects: "/master-data/uacs-objects",
  uacsObject: (id: number) => `/master-data/uacs-objects/${id}`,

  appropriations: "/appropriations",
  appropriation: (id: number) => `/appropriations/${id}`,
  gaaValidate: "/appropriations/import/validate",
  gaaImports: "/appropriations/imports",
  gaaImport: (id: string) => `/appropriations/imports/${id}`,

  allotments: "/allotments",
  allotment: (id: string) => `/allotments/${id}`,
  allotmentCancel: (id: string) => `/allotments/${id}/cancel`,
  allotmentReleases: (id: string) => `/allotments/${id}/releases`,
  allotmentRelease: (id: string, releaseId: string) => `/allotments/${id}/releases/${releaseId}`,
  allotmentReleaseSubmit: (id: string, releaseId: string) => `/allotments/${id}/releases/${releaseId}/submit`,
  allotmentReleaseCancel: (id: string, releaseId: string) => `/allotments/${id}/releases/${releaseId}/cancel`,
  allotmentAttachments: (id: string) => `/allotments/${id}/attachments`,
  allotmentAttachment: (id: string, attachmentId: string) => `/allotments/${id}/attachments/${attachmentId}`,

  approvalRequest: (id: string) => `/approval-requests/${id}`,
  approvalStepApprove: (id: string, stepId: string) => `/approval-requests/${id}/steps/${stepId}/approve`,
  approvalStepReject: (id: string, stepId: string) => `/approval-requests/${id}/steps/${stepId}/reject`,
  approvalStepSignature: (id: string, stepId: string) => `/approval-requests/${id}/steps/${stepId}/signature`,

  agencyProfile: "/system-administration/agency-profile",
  agencyLogo: "/system-administration/agency-profile/logo",
  approvalWorkflows: "/system-administration/approval-workflows",
  approvalWorkflow: (id: string) => `/system-administration/approval-workflows/${id}`,
  signatories: "/system-administration/signatories",
  signatory: (id: string) => `/system-administration/signatories/${id}`,

  permissions: "/permissions",
  roles: "/roles",
  role: (id: string) => `/roles/${id}`,
  users: "/users",
  user: (id: string) => `/users/${id}`,
  userRoles: (id: string) => `/users/${id}/roles`,
  userDeactivate: (id: string) => `/users/${id}/deactivate`,
  userActivate: (id: string) => `/users/${id}/activate`,

  reportDatasets: "/reports/datasets",
  reportShares: "/reports/shares",
  reportShare: (id: number) => `/reports/shares/${id}`,
} as const;

/**
 * Turns an absolute URL the backend put in a response (download_url,
 * logo_url, signature_url) into a path for the API client, so the file is
 * fetched through the data proxy with the session token.
 */
export function backendPath(url: string): string {
  const match = /\/api\/v1\/[a-z]+(\/.*)$/.exec(url);
  return match ? match[1] : url;
}

export const ENDPOINTS = {
  /**
   * In real auth mode these are served by the Next.js auth proxy
   * (/api/auth/*), which maps login, logout and me to the backend's
   * /api/v1/{system}/auth/*. register / forgot-password / reset-password
   * exist only in the mock API (the backend has no such endpoints).
   */
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    register: "/auth/register",
    me: "/auth/me",
    /** PUT: change the caller's own password (backend; auth proxy src/app/api/auth/password). */
    password: "/auth/password",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
  },
  dashboard: {
    overview: "/dashboard/overview",
    recentTransactions: "/dashboard/recent-transactions",
  },
  appropriations: {
    list: "/appropriations",
    detail: (id: string) => `/appropriations/${id}`,
    summary: "/appropriations/summary",
    lookups: "/appropriations/lookups",
    documents: "/appropriations/documents",
  },
  allotments: {
    list: "/allotments",
    summary: "/allotments/summary",
    nextNumber: "/allotments/next-number",
    documents: "/allotments/documents",
    detail: (id: string) => `/allotments/${id}`,
    attachDocument: (id: string) => `/allotments/${id}/documents`,
    workflow: (id: string) => `/allotments/${id}/workflow`,
    registry: "/allotments/registry",
    updateRegistry: (id: string) => `/allotments/${id}/registry`,
    document: (id: string, docId: string) => `/allotments/${id}/documents/${docId}`,
  },
  gaa: {
    uploads: "/gaa/uploads",
    upload: (id: string) => `/gaa/uploads/${id}`,
    rows: (id: string) => `/gaa/uploads/${id}/rows`,
    columns: (id: string) => `/gaa/uploads/${id}/columns`,
    validate: (id: string) => `/gaa/uploads/${id}/validate`,
    import: (id: string) => `/gaa/uploads/${id}/import`,
  },
  obligations: {
    list: "/obligations",
    summary: "/obligations/summary",
    lookups: "/obligations/lookups",
    nextNumber: "/obligations/next-number",
    documents: "/obligations/documents",
    detail: (id: string) => `/obligations/${id}`,
    workflow: (id: string) => `/obligations/${id}/workflow`,
  },
  allotmentClasses: {
    registry: (code: string) => `/allotment-classes/${code}/registry`,
    lookups: (code: string) => `/allotment-classes/${code}/lookups`,
  },
  bfars: {
    report: (id: string) => `/bfars/${id}`,
    /** Records a generated BFARS report in the report history. */
    generate: (id: string) => `/bfars/${id}/generate`,
    /** Previously generated copies of a BFARS report. */
    generated: (id: string) => `/bfars/${id}/generated`,
    qpro: "/bfars/bfars-1/qpro",
    saaodb: "/bfars/bfars-2/saaodb",
    saaodboe: "/bfars/bfars-3/saaodboe",
    lasa: "/bfars/bfars-4/lasa",
    sodlbiaft: "/bfars/bfars-5/sodlbiaft",
    sabudb: "/bfars/bfars-6/sabudb",
    sabudboe: "/bfars/bfars-7/sabudboe",
    auo: "/bfars/bfars-8/auo",
    mrd: "/bfars/bfars-9/mrd",
    qrror: "/bfars/bfars-10/qrror",
    sabudbtr: "/bfars/bfars-11/sabudbtr",
  },
  reports: {
    list: "/reports",
    history: "/reports/history",
    generate: "/reports/generate",
    download: (id: string) => `/reports/history/${id}/download`,
  },
  profile: {
    me: "/profile",
    changePassword: "/profile/change-password",
  },
  notifications: {
    list: "/notifications",
    read: (id: string) => `/notifications/${id}/read`,
    readAll: "/notifications/read-all",
  },
} as const;
