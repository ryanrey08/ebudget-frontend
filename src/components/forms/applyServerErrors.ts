import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "@/lib/api/error-handler";

/** Maps API field errors (422) onto react-hook-form fields. Returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  if (!isApiError(error) || !error.fieldErrors) return false;
  Object.entries(error.fieldErrors).forEach(([field, message]) =>
    setError(field as Path<T>, { type: "server", message }),
  );
  return true;
}
