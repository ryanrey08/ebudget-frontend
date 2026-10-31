import { z } from "zod";
import { ALLOTMENT_CLASS_CODES } from "@/lib/constants/allotment-classes";
import { TRANCHE_TYPES } from "../types";

const money = (label: string) =>
  z.number({ error: `Enter the ${label}` }).refine((v) => Number.isFinite(v) && v > 0, `${label[0].toUpperCase()}${label.slice(1)} must be greater than zero`);

/**
 * New Allotment form: required fields plus amount limits against the selected
 * appropriation's remaining balance (passed in as `maxAmount`).
 */
export function allotmentFormSchema(maxAmount: number | null) {
  return z
    .object({
      fiscalYear: z.number(),
      appropriationRef: z.string().min(1, "Select an appropriation"),
      allotmentClass: z.enum(ALLOTMENT_CLASS_CODES, { error: "Select an allotment class" }),
      fundSource: z.string().min(1, "Select a fund source"),
      amount: money("allotment amount").refine(
        (v) => maxAmount === null || v <= maxAmount,
        "Amount exceeds the remaining unallotted balance",
      ),
      tranche: z.enum(TRANCHE_TYPES),
      releaseAmount: money("release amount"),
      releaseDate: z.string().min(1, "Select the release date"),
      purpose: z.string().trim().min(1, "Enter the purpose/particulars").max(500, "Up to 500 characters"),
    })
    .refine((v) => !(v.releaseAmount > v.amount), {
      path: ["releaseAmount"],
      message: "Release amount cannot exceed the allotment amount",
    });
}

export type AllotmentFormValues = z.infer<ReturnType<typeof allotmentFormSchema>>;

export const ALLOTMENT_SECTIONS = {
  appropriation: ["fiscalYear", "appropriationRef"],
  details: ["allotmentClass", "fundSource", "amount", "tranche", "releaseAmount", "releaseDate", "purpose"],
} as const;
