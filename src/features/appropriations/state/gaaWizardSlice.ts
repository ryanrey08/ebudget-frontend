import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { GaaFieldKey, GaaImportSettings, GaaMapping } from "../types";

export const GAA_STEPS = ["upload", "validate", "map", "import"] as const;
export type GaaStep = (typeof GAA_STEPS)[number];

/**
 * Progress through the GAA Upload workflow. Kept in Redux so the selected
 * file, mapping and settings survive navigating away and back to the page.
 * Row data itself stays in the RTK Query cache.
 */
export interface GaaWizardState {
  step: GaaStep;
  batchId: string | null;
  mapping: GaaMapping | null;
  settings: GaaImportSettings | null;
}

const initialState: GaaWizardState = { step: "upload", batchId: null, mapping: null, settings: null };

const gaaWizardSlice = createSlice({
  name: "gaaWizard",
  initialState,
  reducers: {
    batchSelected: (_state, action: PayloadAction<{ batchId: string; step?: GaaStep }>) => ({
      ...initialState,
      batchId: action.payload.batchId,
      step: action.payload.step ?? "upload",
    }),
    stepChanged: (state, action: PayloadAction<GaaStep>) => {
      state.step = action.payload;
    },
    mappingChanged: (state, action: PayloadAction<GaaMapping>) => {
      state.mapping = action.payload;
    },
    fieldMapped: (state, action: PayloadAction<{ field: GaaFieldKey; column: string }>) => {
      if (state.mapping) state.mapping[action.payload.field] = action.payload.column;
    },
    settingsChanged: (state, action: PayloadAction<GaaImportSettings>) => {
      state.settings = action.payload;
    },
    wizardReset: () => initialState,
  },
  selectors: {
    selectGaaWizard: (state) => state,
  },
});

export const { batchSelected, stepChanged, mappingChanged, fieldMapped, settingsChanged, wizardReset } =
  gaaWizardSlice.actions;
export const { selectGaaWizard } = gaaWizardSlice.selectors;
export default gaaWizardSlice;
