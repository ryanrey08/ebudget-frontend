export const siteConfig = {
  name: "eBudget",
  tagline: "Budget, Allotment and Obligation Monitoring",
  description:
    "eBudget is a budget management system for appropriations, allotments, obligations and BFARS financial reporting.",
  logo: "/brand/ebudget-logo.png",
  emblem: "/brand/ebudget-emblem.png",
} as const;

export const FISCAL_YEARS = [2026, 2025, 2024] as const;
export type FiscalYear = (typeof FISCAL_YEARS)[number];
export const DEFAULT_FISCAL_YEAR: FiscalYear = 2026;

export const AGENCIES = [
  { id: "mpc", name: "Marikina Polytechnic College", code: "08 011 0000000" },
] as const;
export type AgencyId = (typeof AGENCIES)[number]["id"];
