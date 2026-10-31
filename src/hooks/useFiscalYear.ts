import { useAppSelector } from "@/store/hooks";
import { selectFiscalYear } from "@/store/slices/filtersSlice";

/** Fiscal year chosen in the header; every module scopes its queries by it. */
export function useFiscalYear() {
  return useAppSelector(selectFiscalYear);
}
