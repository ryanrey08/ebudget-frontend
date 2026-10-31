export const ALLOTMENT_CLASS_CODES = ["RAOPS", "RAOMO", "RAOCO", "RAOFE"] as const;
export type AllotmentClassCode = (typeof ALLOTMENT_CLASS_CODES)[number];

export interface AllotmentClassMeta {
  code: AllotmentClassCode;
  /** URL segment under /allotment-classes */
  slug: string;
  name: string;
  expenseClass: string;
  /** Tailwind-independent hex used by charts and legend dots. */
  color: string;
}

export const ALLOTMENT_CLASSES: AllotmentClassMeta[] = [
  {
    code: "RAOPS",
    slug: "raop",
    name: "Registry of Allotments and Obligations – Personnel Services",
    expenseClass: "Personnel Services (PS)",
    color: "#2f7cf6",
  },
  {
    code: "RAOMO",
    slug: "raomo",
    name: "Registry of Allotments and Obligations – Maintenance and Other Operating Expenses",
    expenseClass: "Maintenance and Other Operating Expenses (MOOE)",
    color: "#ec2027",
  },
  {
    code: "RAOCO",
    slug: "raoco",
    name: "Registry of Allotments and Obligations – Capital Outlay",
    expenseClass: "Capital Outlay (CO)",
    color: "#3cb455",
  },
  {
    code: "RAOFE",
    slug: "raofe",
    name: "Registry of Allotments and Obligations – Financial Expenses",
    expenseClass: "Financial Expenses (FE)",
    color: "#f7a01d",
  },
];

export function getAllotmentClassBySlug(slug: string) {
  return ALLOTMENT_CLASSES.find((c) => c.slug === slug);
}

export function getAllotmentClass(code: AllotmentClassCode) {
  return ALLOTMENT_CLASSES.find((c) => c.code === code)!;
}
