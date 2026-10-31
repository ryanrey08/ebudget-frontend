import { z } from "zod";
import { ALLOTMENT_CLASS_CODES } from "@/lib/constants/allotment-classes";

const amount = z
  .number({ error: "Enter an amount" })
  .positive("Amount must be greater than zero")
  .max(10_000_000_000, "Amount is too large");

const required = (label: string) => z.string().trim().min(1, `${label} is required`);

/**
 * New Appropriation form. Only presence/format checks: required fields, an
 * 8-digit UACS code, a positive amount and an expiry date not before the
 * effectivity date. Appropriation rules are enforced by the backend.
 */
export const appropriationSchema = z
  .object({
    fiscalYear: z.number(),
    title: required("Appropriation title"),
    type: z.enum(["GAA", "Supplemental"]),
    orgCode: required("Organization/Office"),
    program: required("Program/Activity"),
    uacsCode: z.string().trim().regex(/^\d{8}$/, "UACS code must be 8 digits"),
    objectOfExpenditure: required("Description"),
    fundSource: required("Fund source"),
    allotmentClass: z.enum(ALLOTMENT_CLASS_CODES, { error: "Select an allotment class" }),
    amount,
    level: required("Appropriation level"),
    gaaReference: required("GAA reference"),
    gaaPart: z.string().trim(),
    effectivityDate: required("Effectivity date"),
    expiryDate: z.string(),
    remarks: z.string().max(500, "Remarks can be up to 500 characters"),
  })
  .refine((v) => !v.expiryDate || !v.effectivityDate || v.expiryDate >= v.effectivityDate, {
    path: ["expiryDate"],
    message: "Expiry date cannot be earlier than the effectivity date",
  });
export type AppropriationValues = z.infer<typeof appropriationSchema>;

/** Fields grouped by form section, used for the validation checklist. */
export const APPROPRIATION_SECTIONS = {
  general: ["fiscalYear", "title", "type", "orgCode", "program"],
  budget: ["uacsCode", "objectOfExpenditure", "fundSource", "amount", "allotmentClass"],
  additional: ["level", "gaaReference", "gaaPart", "effectivityDate", "expiryDate", "remarks"],
} as const satisfies Record<string, readonly (keyof AppropriationValues)[]>;

export const allotmentSchema = z.object({
  appropriationRef: z.string().min(1, "Select the source appropriation"),
  allottee: z.string().trim().min(2, "Enter the allottee / office"),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  purpose: z.string().trim().min(3, "Describe the purpose"),
  amount,
});
export type AllotmentValues = z.infer<typeof allotmentSchema>;
