import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SabudbtrParams } from "./types";

export type SabudbtrGroupBy = "fund" | "activity";
export type SabudbtrFormat = "pdf" | "xlsx" | "xls";

/** Display options of the BFARS 11 report generator (labels as in the mockup). */
export interface SabudbtrDocOptions {
  summary: boolean;
  details: boolean;
  previousQuarter: boolean;
  percentUtilized: boolean;
  signatories: boolean;
}

/**
 * BFARS 11 report parameters and generator settings. Kept in Redux so the filters applied on the dashboard
 * carry over to the report generator (and back), and the generator's options survive leaving the page.
 * The report data itself stays in the RTK Query cache.
 */
export interface SabudbtrState {
  /** Null until the user applies filters; the pages then start from the selected fiscal year, Q1. */
  params: SabudbtrParams | null;
  groupBy: SabudbtrGroupBy;
  options: SabudbtrDocOptions;
  format: SabudbtrFormat;
}

export const DEFAULT_SABUDBTR_OPTIONS: SabudbtrDocOptions = { summary: true, details: true, previousQuarter: false, percentUtilized: true, signatories: true };

const initialState: SabudbtrState = { params: null, groupBy: "fund", options: DEFAULT_SABUDBTR_OPTIONS, format: "pdf" };

const sabudbtrSlice = createSlice({
  name: "sabudbtr",
  initialState,
  reducers: {
    paramsApplied: (state, action: PayloadAction<SabudbtrParams>) => {
      state.params = action.payload;
    },
    groupByChanged: (state, action: PayloadAction<SabudbtrGroupBy>) => {
      state.groupBy = action.payload;
    },
    optionToggled: (state, action: PayloadAction<{ key: keyof SabudbtrDocOptions; value: boolean }>) => {
      state.options[action.payload.key] = action.payload.value;
    },
    formatChanged: (state, action: PayloadAction<SabudbtrFormat>) => {
      state.format = action.payload;
    },
    sabudbtrReset: () => initialState,
  },
  selectors: {
    selectSabudbtr: (state) => state,
  },
});

export const { paramsApplied, groupByChanged, optionToggled, formatChanged, sabudbtrReset } = sabudbtrSlice.actions;
export const { selectSabudbtr } = sabudbtrSlice.selectors;
export default sabudbtrSlice;
