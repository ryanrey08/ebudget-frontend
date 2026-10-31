export const ROUTES = {
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  dashboard: "/dashboard",
  gaaUpload: "/appropriations/gaa-upload",
  appropriations: "/appropriations/appropriations",
  newAppropriation: "/appropriations/appropriations/new",
  allotments: "/appropriations/allotments",
  newAllotment: "/appropriations/allotments/new",
  allotment: (id: string) => `/appropriations/allotments/${id}`,
  obligationManagement: "/obligation-management",
  newObligation: "/obligation-management/new",
  obligation: (id: string) => `/obligation-management/${id}`,
  editObligation: (id: string) => `/obligation-management/${id}/edit`,
  allotmentClass: (slug: string) => `/allotment-classes/${slug}`,
  newClassAllotment: (slug: string) => `/allotment-classes/${slug}/new`,
  classAllotment: (slug: string, id: string) => `/allotment-classes/${slug}/${id}`,
  editClassAllotment: (slug: string, id: string) => `/allotment-classes/${slug}/${id}/edit`,
  bfars: (id: string) => `/bfars-reporting/${id}`,
  reports: "/reports",
  profile: "/settings/profile",
} as const;

export const AUTH_ROUTES = [ROUTES.login, ROUTES.register, ROUTES.forgotPassword, ROUTES.resetPassword];

export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/appropriations",
  "/obligation-management",
  "/allotment-classes",
  "/bfars-reporting",
  "/reports",
  "/settings",
];
