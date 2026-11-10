import { useCallback } from "react";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import type { BfarsReportId } from "@/services/bfars.service";
import { useGenerateBfarsReportMutation } from "../services/bfarsApi";

/**
 * Saves a generated BFARS report to the report history
 * (POST /bfars/{id}/generate). The file itself is produced in the browser;
 * a failure here does not undo the download, it only warns the user.
 */
export function useRecordGeneration(id: BfarsReportId) {
  const [record] = useGenerateBfarsReportMutation();
  const notify = useNotify();
  return useCallback(
    (params: object, format: string, options?: Record<string, unknown>) => {
      record({ id, params: { ...params }, format, options })
        .unwrap()
        .catch((err) => notify("warning", "Report not saved to history", getErrorMessage(err)));
    },
    [id, notify, record],
  );
}
