"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AmountInput } from "@/components/forms/AmountInput";
import { FormField } from "@/components/forms/FormField";
import { formatCurrency } from "@/lib/utils/format";
import type { ReleaseKind } from "../../types/records";

export interface ReleaseValues {
  release_kind: ReleaseKind;
  amount: number;
  release_date: string;
  reference_no: string;
}

export const emptyRelease = (date = ""): ReleaseValues => ({ release_kind: "tranche", amount: Number.NaN, release_date: date, reference_no: "" });

/** Client checks mirroring AllotmentRules (the backend checks everything again). */
export function validateRelease(v: ReleaseValues, opts: { left: number; period?: { from: string; to: string | null } }, prefix = "") {
  const e: Record<string, string> = {};
  if (v.release_kind === "tranche") {
    if (!Number.isFinite(v.amount) || v.amount <= 0) e[`${prefix}amount`] = "Enter the release amount.";
    else if (v.amount > opts.left + 1e-9) e[`${prefix}amount`] = `The release amount can't be more than what is left to release (${formatCurrency(opts.left)}).`;
  }
  if (!v.release_date) e[`${prefix}release_date`] = "Enter the release date.";
  else if (opts.period && (v.release_date < opts.period.from || (opts.period.to && v.release_date > opts.period.to)))
    e[`${prefix}release_date`] = `The release date must be within the line's effectivity period (${opts.period.from} to ${opts.period.to ?? "open-ended"}).`;
  if (v.reference_no.length > 100) e[`${prefix}reference_no`] = "At most 100 characters.";
  return e;
}

export function ReleaseFields({
  values,
  onChange,
  errors,
  prefix = "",
  left,
  trancheLabel,
}: {
  values: ReleaseValues;
  onChange: (patch: Partial<ReleaseValues>) => void;
  errors: Record<string, string>;
  /** Error key prefix, e.g. "release." on the create call. */
  prefix?: string;
  /** What is left to release: a full release takes exactly this. */
  left: number;
  trancheLabel?: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <FormField label="Release" htmlFor="release_kind" error={errors[`${prefix}release_kind`]} required hint={trancheLabel ? `This is the ${trancheLabel}.` : undefined}>
        <Select
          id="release_kind"
          value={values.release_kind}
          onChange={(e) => onChange({ release_kind: e.target.value as ReleaseKind })}
          options={[
            { value: "tranche", label: "Tranche (partial)" },
            { value: "full", label: "Full release (everything left)" },
          ]}
        />
      </FormField>
      <FormField label="Release amount" htmlFor="release_amount" error={errors[`${prefix}amount`]} required={values.release_kind === "tranche"} hint={`Left to release: ${formatCurrency(left)}`}>
        {values.release_kind === "full" ? (
          <Input id="release_amount" disabled value={formatCurrency(left)} />
        ) : (
          <AmountInput id="release_amount" value={values.amount} onChange={(n) => onChange({ amount: n })} invalid={!!errors[`${prefix}amount`]} />
        )}
      </FormField>
      <FormField label="Release date" htmlFor="release_date" error={errors[`${prefix}release_date`]} required>
        <Input id="release_date" type="date" value={values.release_date} onChange={(e) => onChange({ release_date: e.target.value })} invalid={!!errors[`${prefix}release_date`]} />
      </FormField>
      <FormField label="Reference no. (SARO / ABM)" htmlFor="reference_no" error={errors[`${prefix}reference_no`]}>
        <Input id="reference_no" maxLength={100} value={values.reference_no} onChange={(e) => onChange({ reference_no: e.target.value })} />
      </FormField>
    </div>
  );
}
