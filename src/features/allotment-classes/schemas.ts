import { z } from "zod";
import { TRANCHE_TYPES } from "@/features/allotments/types";

const positive = (label: string) =>
  z.number({ error: `Enter the ${label}` }).refine((v) => Number.isFinite(v) && v > 0, `${label[0].toUpperCase()}${label.slice(1)} must be greater than zero`);

export const registryLineSchema = z.object({
  uacsCode: z.string().trim().min(1, "UACS code is required").regex(/^\d+$/, "Digits only"),
  description: z.string().trim().min(1, "Description is required"),
  quantity: positive("quantity"),
  unit: z.string().min(1, "Unit is required"),
  unitCost: positive("unit cost"),
  remarks: z.string().trim(),
});

/**
 * Allotment form on an allotment-class page: required fields, complete line
 * items, and the total must fit the reference appropriation's balance.
 */
export function registryAllotmentSchema(maxTotal: number | null, requireSchedule = false) {
  return z
    .object({
      fiscalYear: z.number(),
      appropriationRef: z.string().min(1, "Select the reference appropriation"),
      tranche: z.enum(TRANCHE_TYPES),
      date: z.string().min(1, "Select the date of allotment"),
      gaaReferenceNo: z.string().trim().min(1, "GAA reference no. is required"),
      department: z.string().min(1, "Select the department/office"),
      responsibilityCenter: z.string().trim(),
      fundSource: z.string().min(1, "Select the funding source"),
      uacsCode: z.string().trim().min(1, "UACS is required").regex(/^\d+$/, "Digits only"),
      purpose: z.string().trim().min(1, "Particulars/description is required").max(500),
      remarks: z.string().max(500, "Up to 500 characters"),
      lineItems: z.array(registryLineSchema).min(1, "Add at least one line item"),
      effectivityDate: z.string().optional(),
      validityDate: z.string().optional(),
    })
    .refine((v) => !requireSchedule || !!v.effectivityDate, { path: ["effectivityDate"], message: "Select the effectivity date" })
    .refine((v) => !requireSchedule || !!v.validityDate, { path: ["validityDate"], message: "Select the validity date" })
    .refine((v) => !v.effectivityDate || !v.validityDate || v.validityDate >= v.effectivityDate, {
      path: ["validityDate"],
      message: "Validity date cannot be earlier than the effectivity date",
    })
    .refine(
      (v) => maxTotal === null || v.lineItems.reduce((s, li) => s + li.quantity * li.unitCost, 0) <= maxTotal,
      { path: ["lineItems"], message: "Total amount exceeds the appropriation's remaining unallotted balance" },
    );
}

export type RegistryAllotmentValues = z.infer<ReturnType<typeof registryAllotmentSchema>>;

/**
 * RAOCO wizard: total allotment amount entered separately; it must fit the
 * reference appropriation's balance and the line items must not exceed it.
 */
export function registryWizardSchema(maxAmount: number | null) {
  return z
    .object({
      fiscalYear: z.number(),
      appropriationRef: z.string().min(1, "Select the reference GAA appropriation"),
      tranche: z.enum(TRANCHE_TYPES),
      date: z.string().min(1, "Select the allotment date"),
      gaaReferenceNo: z.string().trim().min(1, "GAA reference no. is required"),
      department: z.string().min(1, "Select the department/office"),
      responsibilityCenter: z.string().trim(),
      fundSource: z.string().min(1, "Select the funding source"),
      uacsCode: z.string().trim().min(1, "UACS code is required").regex(/^\d+$/, "Digits only"),
      purpose: z.string().trim().min(1, "Particulars/description is required").max(500),
      amount: positive("total allotment amount").refine(
        (v) => maxAmount === null || v <= maxAmount,
        "Amount exceeds the appropriation's remaining unallotted balance",
      ),
      remarks: z.string().max(500, "Up to 500 characters"),
      requiredDocuments: z.array(z.string()),
      lineItems: z.array(registryLineSchema).min(1, "Add at least one line item"),
    })
    .refine((v) => v.lineItems.reduce((s, li) => s + li.quantity * li.unitCost, 0) <= v.amount, {
      path: ["lineItems"],
      message: "Line items exceed the total allotment amount",
    });
}

export type RegistryWizardValues = z.infer<ReturnType<typeof registryWizardSchema>>;

export const WIZARD_STEP_FIELDS: (keyof RegistryWizardValues)[][] = [
  ["fiscalYear", "appropriationRef", "tranche", "date", "gaaReferenceNo", "department", "fundSource", "uacsCode", "purpose", "amount"],
  ["lineItems"],
  ["requiredDocuments"],
  ["remarks"],
];

/**
 * RAOFE wizard: the UACS sub-object picks the reference appropriation, and the
 * allotment amount is the line-item total, which must fit that appropriation's
 * remaining balance.
 */
export function raofeWizardSchema(maxAmount: number | null) {
  return z
    .object({
      fiscalYear: z.number(),
      tranche: z.enum(TRANCHE_TYPES),
      date: z.string().min(1, "Select the allotment date"),
      gaaReferenceNo: z.string().trim().min(1, "GAA reference no. is required"),
      department: z.string().min(1, "Select the department/office"),
      responsibilityCenter: z.string().trim().min(1, "Responsibility center is required"),
      uacsMajor: z.string().min(1, "Select the UACS major code"),
      appropriationRef: z.string().min(1, "Select the UACS sub-object code"),
      purpose: z.string().trim().min(1, "Particulars/description is required").max(500),
      remarks: z.string().max(500, "Up to 500 characters"),
      lineItems: z.array(registryLineSchema.extend({ category: z.string() })).min(1, "Add at least one line item"),
    })
    .refine((v) => maxAmount === null || v.lineItems.reduce((s, li) => s + li.quantity * li.unitCost, 0) <= maxAmount, {
      path: ["lineItems"],
      message: "Line items exceed the appropriation's remaining unallotted balance",
    });
}

export type RaofeWizardValues = z.infer<ReturnType<typeof raofeWizardSchema>>;

export const RAOFE_STEP_FIELDS: (keyof RaofeWizardValues)[][] = [
  ["fiscalYear", "tranche", "date", "gaaReferenceNo", "department", "responsibilityCenter", "uacsMajor", "appropriationRef", "purpose", "remarks"],
  ["lineItems"],
  [],
  [],
];
