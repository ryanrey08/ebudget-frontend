import { useCallback } from "react";
import { useAppDispatch } from "@/store/hooks";
import { alertAdded, type AlertVariant } from "@/store/slices/alertsSlice";

/** Shortcut for raising a toast alert from components. */
export function useNotify() {
  const dispatch = useAppDispatch();
  return useCallback(
    (variant: AlertVariant, title: string, description?: string) =>
      dispatch(alertAdded({ variant, title, description })),
    [dispatch],
  );
}
