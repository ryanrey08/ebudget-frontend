import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

export type AlertVariant = "success" | "error" | "info" | "warning";

export interface Alert {
  id: string;
  variant: AlertVariant;
  title: string;
  description?: string;
}

/** Transient toast alerts shown by <Toaster />. */
const alertsSlice = createSlice({
  name: "alerts",
  initialState: [] as Alert[],
  reducers: {
    alertAdded: {
      reducer: (state, action: PayloadAction<Alert>) => {
        state.push(action.payload);
        if (state.length > 4) state.shift();
      },
      prepare: (alert: Omit<Alert, "id">) => ({ payload: { ...alert, id: nanoid() } }),
    },
    alertDismissed: (state, action: PayloadAction<string>) => state.filter((a) => a.id !== action.payload),
  },
  selectors: {
    selectAlerts: (state) => state,
  },
});

export const { alertAdded, alertDismissed } = alertsSlice.actions;
export const { selectAlerts } = alertsSlice.selectors;
export default alertsSlice;
