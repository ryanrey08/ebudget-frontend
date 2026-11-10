/**
 * Every backend path used by the frontend, relative to NEXT_PUBLIC_API_BASE_URL.
 * The mock API registers handlers for exactly these paths, so swapping to the
 * real backend only requires the backend to implement the same contract.
 */
export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    register: "/auth/register",
    me: "/auth/me",
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
