import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { AGENCIES, DEFAULT_FISCAL_YEAR, type AgencyId, type FiscalYear } from "@/config/site";

/** Selections in the header that scope data across every module. */
export interface FiltersState {
  /** A year of FISCAL_YEARS (demo data) or, in real mode, any backend fiscal year. */
  fiscalYear: FiscalYear | number;
  agencyId: AgencyId;
}

const initialState: FiltersState = { fiscalYear: DEFAULT_FISCAL_YEAR, agencyId: AGENCIES[0].id };

const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    fiscalYearChanged: (state, action: PayloadAction<FiscalYear | number>) => {
      state.fiscalYear = action.payload;
    },
    agencyChanged: (state, action: PayloadAction<AgencyId>) => {
      state.agencyId = action.payload;
    },
  },
  selectors: {
    selectFiscalYear: (state) => state.fiscalYear,
    selectAgencyId: (state) => state.agencyId,
  },
});

export const { fiscalYearChanged, agencyChanged } = filtersSlice.actions;
export const { selectFiscalYear, selectAgencyId } = filtersSlice.selectors;
export default filtersSlice;
