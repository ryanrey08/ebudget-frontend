import { z } from "zod";
import { TRANCHE_TYPES } from "@/features/allotments/types";

const required = (label: string) => z.string().trim().min(1, `${label} is required`);
const positive = (label: string) =>
  z.number({ error: `Enter the ${label}` }).refine((v) => Number.isFinite(v) && v > 0, `${label[0].toUpperCase()}${label.slice(1)} must be greater than zero`);

export const lineItemSchema = z.object({
  uacsCode: z.string().trim().min(1, "UACS code is required").regex(/^\d+$/, "Digits only"),
  description: required("Description"),
  quantity: positive("quantity"),
  unit: required("Unit"),
  unitCost: positive("unit cost"),
});

/**
 * Obligation form: required fields, at least one complete line item, and the
 * total must fit the allotment's remaining balance (`maxTotal`).
 */
export function obligationFormSchema(maxTotal: number | null) {
  return z
    .object({
      date: required("Obligation date"),
      allotmentRef: z.string().min(1, "Select an allotment"),
      tranche: z.enum(TRANCHE_TYPES),
      fundSource: z.string().min(1, "Select a fund source"),
      responsibilityCenter: z.string().min(1, "Select the responsibility center"),
      payee: required("Payee/Supplier"),
      tin: z.string().trim(),
      address: z.string().trim(),
      particulars: required("Particulars").max(500, "Up to 500 characters"),
      lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
      appNo: z.string().trim(),
      prNo: z.string().trim(),
      poNo: z.string().trim(),
      modeOfProcurement: z.string(),
      projectActivity: z.string().trim(),
      remarks: z.string().max(500, "Up to 500 characters"),
      applicableDocuments: z.array(z.string()),
    })
    .refine((v) => maxTotal === null || lineTotal(v.lineItems) <= maxTotal, {
      path: ["lineItems"],
      message: "Total amount exceeds the remaining allotment balance",
    });
}

export type ObligationFormValues = z.infer<ReturnType<typeof obligationFormSchema>>;

export function lineTotal(items: { quantity?: number; unitCost?: number }[] | undefined) {
  return (items ?? []).reduce(
    (s, li) => s + (Number.isFinite(li.quantity) && Number.isFinite(li.unitCost) ? Number(li.quantity) * Number(li.unitCost) : 0),
    0,
  );
}
