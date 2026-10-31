import { createListenerMiddleware, isRejectedWithValue } from "@reduxjs/toolkit";
import { isApiError } from "@/lib/api/error-handler";
import { alertAdded } from "../slices/alertsSlice";
import { loggedOut } from "../slices/authSlice";

/**
 * Central place for cross-cutting API error handling:
 *  - 401 from any endpoint (other than the session check) ends the session
 *  - failed queries raise a toast; mutation errors are shown by their forms
 */
export const apiErrorListener = createListenerMiddleware();

apiErrorListener.startListening({
  matcher: isRejectedWithValue,
  effect: (action, { dispatch }) => {
    const error = action.payload;
    if (!isApiError(error)) return;
    const meta = action.meta as { arg?: { type?: string; endpointName?: string } };
    const endpointName = meta.arg?.endpointName;

    if (error.status === 401) {
      if (endpointName !== "getCurrentUser" && endpointName !== "login") {
        dispatch(loggedOut());
        dispatch(alertAdded({ variant: "warning", title: "Session expired", description: error.message }));
      }
      return;
    }

    if (meta.arg?.type === "query") {
      dispatch(alertAdded({ variant: "error", title: "Could not load data", description: error.message }));
    }
  },
});
